import { sql } from "drizzle-orm";
import type { Db } from "./db";
import { cifrarSenha, decifrarSenha } from "@/lib/cripto";

export type Portal = "comprasnet" | "bnc" | "licitanet";
export const PORTAIS: Portal[] = ["comprasnet", "bnc", "licitanet"];
export const ROTULO_PORTAL: Record<Portal, string> = {
  comprasnet: "ComprasNet / Compras.gov.br",
  bnc: "BNC",
  licitanet: "Licitanet",
};

export type EstadoSessao = "aguardando" | "conectando" | "em_disputa" | "encerrado" | "erro" | "parado";

export type Credencial = {
  id: string;
  portal: Portal;
  apelido: string;
  login: string;
  ativo: boolean;
  criadaEm: Date;
};

export type CredencialComSenha = Credencial & { senha: string };

export async function listarCredenciais(db: Db, organizacaoId: string): Promise<Credencial[]> {
  const r = await db.execute<{ id: string; portal: Portal; apelido: string; login: string; ativo: boolean; criado_em: string | Date }>(sql`
    select id, portal, apelido, login, ativo, criado_em from robo_credencial
     where organizacao_id = ${organizacaoId} and ativo = true
     order by criado_em desc
  `);
  return r.rows.map((c) => ({ id: c.id, portal: c.portal, apelido: c.apelido, login: c.login, ativo: c.ativo, criadaEm: new Date(c.criado_em) }));
}

export async function salvarCredencial(
  db: Db, organizacaoId: string, portal: Portal, apelido: string, login: string, senha: string,
): Promise<string> {
  const senhaCifrada = cifrarSenha(senha);
  const r = await db.execute<{ id: string }>(sql`
    insert into robo_credencial (organizacao_id, portal, apelido, login, senha_enc)
    values (${organizacaoId}, ${portal}, ${apelido}, ${login}, ${senhaCifrada})
    on conflict (organizacao_id, portal, login) do update
      set apelido = excluded.apelido, senha_enc = excluded.senha_enc, ativo = true
    returning id
  `);
  return r.rows[0].id;
}

export async function removerCredencial(db: Db, organizacaoId: string, credencialId: string): Promise<void> {
  await db.execute(sql`update robo_credencial set ativo = false where id = ${credencialId} and organizacao_id = ${organizacaoId}`);
}

/** Carrega a credencial COM a senha decifrada. Apenas para o runner. */
export async function obterCredencialComSenha(db: Db, organizacaoId: string, credencialId: string): Promise<CredencialComSenha | null> {
  const r = await db.execute<{ id: string; portal: Portal; apelido: string; login: string; ativo: boolean; senha_enc: string; criado_em: string | Date }>(sql`
    select id, portal, apelido, login, ativo, senha_enc, criado_em from robo_credencial
     where id = ${credencialId} and organizacao_id = ${organizacaoId}
  `);
  const c = r.rows[0];
  if (!c) return null;
  return { id: c.id, portal: c.portal, apelido: c.apelido, login: c.login, ativo: c.ativo, criadaEm: new Date(c.criado_em), senha: decifrarSenha(c.senha_enc) };
}

export type SessaoResumo = {
  id: string;
  roboItemId: string;
  portal: Portal;
  urlDisputa: string;
  numeroItem: number;
  estado: EstadoSessao;
  iniciadaEm: Date;
  encerradaEm: Date | null;
  mensagemFinal: string | null;
};

export async function listarSessoes(db: Db, organizacaoId: string, roboConfigId?: string): Promise<SessaoResumo[]> {
  const r = await db.execute<{
    id: string; robo_item_id: string; portal: Portal; url_disputa: string; numero_item: number;
    estado: EstadoSessao; iniciada_em: string | Date; encerrada_em: string | Date | null; mensagem_final: string | null;
  }>(sql`
    select id, robo_item_id, portal, url_disputa, numero_item, estado, iniciada_em, encerrada_em, mensagem_final
      from robo_sessao
     where organizacao_id = ${organizacaoId}
       ${roboConfigId ? sql`and robo_config_id = ${roboConfigId}` : sql``}
     order by iniciada_em desc limit 50
  `);
  return r.rows.map((s) => ({
    id: s.id, roboItemId: s.robo_item_id, portal: s.portal, urlDisputa: s.url_disputa,
    numeroItem: s.numero_item, estado: s.estado, iniciadaEm: new Date(s.iniciada_em),
    encerradaEm: s.encerrada_em ? new Date(s.encerrada_em) : null, mensagemFinal: s.mensagem_final,
  }));
}

export async function criarSessao(
  db: Db, organizacaoId: string, usuarioId: string,
  roboConfigId: string, roboItemId: string, credencialId: string | null,
  portal: Portal, urlDisputa: string, numeroItem: number,
): Promise<string> {
  const r = await db.execute<{ id: string }>(sql`
    insert into robo_sessao (organizacao_id, robo_config_id, robo_item_id, credencial_id, portal, url_disputa, numero_item, iniciada_por)
    values (${organizacaoId}, ${roboConfigId}, ${roboItemId}, ${credencialId}, ${portal}, ${urlDisputa}, ${numeroItem}, ${usuarioId})
    returning id
  `);
  return r.rows[0].id;
}

export async function atualizarEstadoSessao(
  db: Db, sessaoId: string, estado: EstadoSessao, mensagemFinal?: string,
): Promise<void> {
  const encerrada = estado === "encerrado" || estado === "erro" || estado === "parado";
  await db.execute(sql`
    update robo_sessao set estado = ${estado},
      mensagem_final = ${mensagemFinal ?? null},
      encerrada_em = ${encerrada ? sql`now()` : sql`encerrada_em`}
     where id = ${sessaoId}
  `);
}

export async function lerEstadoSessao(db: Db, sessaoId: string): Promise<EstadoSessao | null> {
  const r = await db.execute<{ estado: EstadoSessao }>(sql`select estado from robo_sessao where id = ${sessaoId}`);
  return r.rows[0]?.estado ?? null;
}

export type EntradaLog = { nivel?: "info" | "lance" | "aviso" | "erro"; texto: string; detalhe?: unknown };

export async function gravarLog(db: Db, sessaoId: string, organizacaoId: string, entrada: EntradaLog): Promise<void> {
  await db.execute(sql`
    insert into robo_log (sessao_id, organizacao_id, nivel, texto, detalhe)
    values (${sessaoId}, ${organizacaoId}, ${entrada.nivel ?? "info"}, ${entrada.texto},
            ${entrada.detalhe ? JSON.stringify(entrada.detalhe) : null}::jsonb)
  `);
}

export type LogEntry = { id: string; instante: Date; nivel: "info" | "lance" | "aviso" | "erro"; texto: string; detalhe: unknown };

export async function buscarLogs(db: Db, sessaoId: string, organizacaoId: string, aposId?: string): Promise<LogEntry[]> {
  const r = await db.execute<{ id: string; instante: string | Date; nivel: "info" | "lance" | "aviso" | "erro"; texto: string; detalhe: unknown }>(sql`
    select id::text, instante, nivel, texto, detalhe from robo_log
     where sessao_id = ${sessaoId} and organizacao_id = ${organizacaoId}
       ${aposId ? sql`and id > ${aposId}::bigint` : sql``}
     order by id limit 200
  `);
  return r.rows.map((e) => ({ id: e.id, instante: new Date(e.instante), nivel: e.nivel, texto: e.texto, detalhe: e.detalhe }));
}

export async function obterSessaoCompleta(db: Db, sessaoId: string, organizacaoId: string): Promise<SessaoResumo | null> {
  const r = await db.execute<{
    id: string; robo_item_id: string; portal: Portal; url_disputa: string; numero_item: number;
    estado: EstadoSessao; iniciada_em: string | Date; encerrada_em: string | Date | null; mensagem_final: string | null;
  }>(sql`
    select id, robo_item_id, portal, url_disputa, numero_item, estado, iniciada_em, encerrada_em, mensagem_final
      from robo_sessao where id = ${sessaoId} and organizacao_id = ${organizacaoId}
  `);
  const s = r.rows[0];
  if (!s) return null;
  return {
    id: s.id, roboItemId: s.robo_item_id, portal: s.portal, urlDisputa: s.url_disputa,
    numeroItem: s.numero_item, estado: s.estado, iniciadaEm: new Date(s.iniciada_em),
    encerradaEm: s.encerrada_em ? new Date(s.encerrada_em) : null, mensagemFinal: s.mensagem_final,
  };
}
