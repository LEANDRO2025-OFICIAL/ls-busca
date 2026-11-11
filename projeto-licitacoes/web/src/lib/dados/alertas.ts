import { sql } from "drizzle-orm";
import {
  casar,
  lerLimiteComunidade,
  lerTermos,
  montarCorpoWebhook,
  type AvisoParaWebhook,
  type Criterio,
} from "@/lib/casamento";
import { lerFiltros } from "@/lib/filtros-busca";
import type { Db } from "./db";
import { obterPerfil, type Perfil } from "./perfil";

export type TipoAlerta = "busca" | "comunidade";

export type BuscaSalva = {
  id: string;
  nome: string;
  tipo: TipoAlerta;
  /** Parâmetros da URL da busca (q, uf, mun, mod...), já validados ao salvar. */
  parametros: Record<string, string>;
  /** Pausado = não gera avisos novos; o histórico fica. */
  ativo: boolean;
  criadoEm: Date;
  naoLidos: number;
  totalAvisos: number;
};

type Entrada = { nome: string; parametros: Record<string, string> };

const separar = ({ q = "", ...filtros }: Record<string, string>) => ({ q, filtros: JSON.stringify(filtros) });

export async function salvarBusca(db: Db, organizacaoId: string, usuarioId: string, entrada: Entrada, tipo: TipoAlerta = "busca") {
  const { q, filtros } = separar(entrada.parametros);
  await db.execute(sql`
    insert into busca_salva (organizacao_id, usuario_id, nome, texto, filtros, alerta_ativo, tipo)
    values (${organizacaoId}, ${usuarioId}, ${entrada.nome}, ${q}, ${filtros}::jsonb, true, ${tipo})
  `);
}

/** Troca nome e filtros. O histórico de avisos continua (o que já foi avisado não é avisado de novo). */
export async function atualizarBusca(db: Db, organizacaoId: string, id: string, entrada: Entrada) {
  const { q, filtros } = separar(entrada.parametros);
  await db.execute(sql`
    update busca_salva set nome = ${entrada.nome}, texto = ${q}, filtros = ${filtros}::jsonb
     where id = ${id} and organizacao_id = ${organizacaoId}
  `);
}

/** Pausa ou retoma. Ao retomar, só conta o que entrar na base dali em diante. */
export async function definirAlertaAtivo(db: Db, organizacaoId: string, id: string, ativo: boolean) {
  await db.execute(sql`
    update busca_salva
       set alerta_ativo = ${ativo}, ultimo_alerta_em = case when ${ativo} then now() else ultimo_alerta_em end
     where id = ${id} and organizacao_id = ${organizacaoId}
  `);
}

/** Alertas de busca são da organização; interesses da comunidade são de cada pessoa (passe usuarioId). */
export async function listarBuscasSalvas(
  db: Db,
  organizacaoId: string,
  opcoes: { tipo?: TipoAlerta; usuarioId?: string } = {},
): Promise<BuscaSalva[]> {
  const r = await db.execute<{
    id: string;
    nome: string;
    tipo: TipoAlerta;
    texto: string;
    filtros: Record<string, string> | string;
    alerta_ativo: boolean;
    created_at: string | Date;
    nao_lidos: string | number;
    total: string | number;
  }>(sql`
    select b.id, b.nome, b.tipo, b.texto, b.filtros, b.alerta_ativo, b.created_at,
           (select count(*) from aviso a where a.busca_salva_id = b.id and a.lido_em is null) as nao_lidos,
           (select count(*) from aviso a where a.busca_salva_id = b.id) as total
      from busca_salva b
     where b.organizacao_id = ${organizacaoId}
       and b.tipo = ${opcoes.tipo ?? "busca"}
       ${opcoes.usuarioId ? sql`and b.usuario_id = ${opcoes.usuarioId}` : sql``}
     order by b.created_at desc
     limit 50
  `);
  return r.rows.map((b) => {
    const filtros = typeof b.filtros === "string" ? JSON.parse(b.filtros) : b.filtros;
    return {
      id: b.id,
      nome: b.nome,
      tipo: b.tipo,
      parametros: { ...filtros, q: b.texto },
      ativo: b.alerta_ativo,
      criadoEm: new Date(b.created_at),
      naoLidos: Number(b.nao_lidos),
      totalAvisos: Number(b.total),
    };
  });
}

export type AvisoDoBanco = {
  id: string;
  alertaId: string;
  alertaNome: string;
  motivo: string;
  criadoEm: Date;
  lido: boolean;
  /** Entregue ao webhook externo (null = não enviado ou webhook desligado). */
  enviadoEm: Date | null;
  objeto: string;
  orgao: string;
  uf: string;
  municipio: string | null;
  valorCentavos: number | null;
  href: string;
};

/** Avisos gerados (histórico), do mais novo para o mais antigo. */
export async function listarAvisos(
  db: Db,
  organizacaoId: string,
  opcoes: { tipo?: TipoAlerta; usuarioId?: string; alertaId?: string; apenasNaoLidos?: boolean; limite?: number } = {},
): Promise<AvisoDoBanco[]> {
  const r = await db.execute<{
    id: string;
    busca_salva_id: string;
    nome: string;
    motivo: string;
    created_at: string | Date;
    lido_em: string | Date | null;
    enviado_em: string | Date | null;
    objeto: string;
    orgao_nome: string;
    uf: string;
    municipio: string | null;
    valor: string | number | null;
    cnpj_orgao: string;
    ano: number;
    sequencial: number;
  }>(sql`
    select a.id, a.busca_salva_id, b.nome, a.motivo, a.created_at, a.lido_em, a.enviado_em,
           l.objeto, l.orgao_nome, l.uf, l.municipio, l.valor_estimado_centavos as valor,
           l.cnpj_orgao, l.ano, l.sequencial
      from aviso a
      join busca_salva b on b.id = a.busca_salva_id
      join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
     where b.organizacao_id = ${organizacaoId}
       and b.tipo = ${opcoes.tipo ?? "busca"}
       ${opcoes.usuarioId ? sql`and b.usuario_id = ${opcoes.usuarioId}` : sql``}
       ${opcoes.alertaId ? sql`and b.id = ${opcoes.alertaId}` : sql``}
       ${opcoes.apenasNaoLidos ? sql`and a.lido_em is null` : sql``}
     order by a.created_at desc, a.id
     limit ${Math.min(200, opcoes.limite ?? 50)}
  `);
  return r.rows.map((a) => ({
    id: a.id,
    alertaId: a.busca_salva_id,
    alertaNome: a.nome,
    motivo: a.motivo,
    criadoEm: new Date(a.created_at),
    lido: a.lido_em != null,
    enviadoEm: a.enviado_em == null ? null : new Date(a.enviado_em),
    objeto: a.objeto,
    orgao: a.orgao_nome,
    uf: a.uf,
    municipio: a.municipio,
    valorCentavos: a.valor == null ? null : Number(a.valor),
    href: `/licitacao/${a.cnpj_orgao}/${a.ano}/${a.sequencial}`,
  }));
}

/** Para o sino: alertas (da organização) e interesses da comunidade (da pessoa) com avisos não lidos. */
export async function avisosNaoLidosPorAlerta(db: Db, organizacaoId: string, usuarioId: string) {
  const r = await db.execute<{ id: string; nome: string; tipo: TipoAlerta; total: string | number }>(sql`
    select b.id, b.nome, b.tipo, count(*) as total
      from aviso a join busca_salva b on b.id = a.busca_salva_id
     where b.organizacao_id = ${organizacaoId} and a.lido_em is null
       and (b.tipo = 'busca' or b.usuario_id = ${usuarioId})
     group by b.id, b.nome, b.tipo
     order by max(a.created_at) desc
     limit 10
  `);
  return r.rows.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, total: Number(a.total) }));
}

export async function marcarBuscaVista(db: Db, organizacaoId: string, id: string) {
  await db.execute(sql`
    update aviso a set lido_em = now()
      from busca_salva b
     where b.id = a.busca_salva_id and b.id = ${id} and b.organizacao_id = ${organizacaoId} and a.lido_em is null
  `);
  await db.execute(sql`update busca_salva set visto_em = now() where id = ${id} and organizacao_id = ${organizacaoId}`);
}

export async function removerBusca(db: Db, organizacaoId: string, id: string) {
  await db.execute(sql`delete from busca_salva where id = ${id} and organizacao_id = ${organizacaoId}`);
}

// ---------------------------------------------------------------------------
// Geração de avisos (chamada pela ingestão)
// ---------------------------------------------------------------------------

/** Transforma os parâmetros salvos no critério do casamento. Filtros "encerra" e "aderência" não entram. */
export function criterioDoAlerta(
  alerta: { tipo: TipoAlerta; parametros: Record<string, string> },
  perfil: Perfil | null,
  limiteComunidadeCentavos: number,
): Criterio {
  const f = lerFiltros(alerta.parametros);
  const { termos, excluidos } = lerTermos(f.q);
  const doRamo = f.ramo && perfil && perfil.termos.length > 0;
  const minimo = f.valorMin == null ? null : f.valorMin * 100;
  return {
    termos,
    excluidos: doRamo ? [...excluidos, ...perfil.termosExcluidos] : excluidos,
    algumDe: doRamo ? perfil.termos : undefined,
    uf: f.uf,
    municipio: f.municipio,
    modalidade: f.modalidade,
    // Interesse da comunidade nunca fica abaixo do piso do mural.
    valorMinCentavos: alerta.tipo === "comunidade" ? Math.max(minimo ?? 0, limiteComunidadeCentavos) : minimo,
    valorMaxCentavos: f.valorMax == null ? null : f.valorMax * 100,
  };
}

const LOTE = 500;

export type ResultadoAvisos = { avisos: number; webhook: "desligado" | "enviado" | "falhou" | "nada" };

/**
 * Casa as licitações que entraram na base desde a última passada com os alertas ativos e grava um
 * aviso por par (alerta, licitação). A chave única de aviso garante que nada é avisado duas vezes.
 */
export async function gerarAvisos(db: Db, env: Record<string, string | undefined> = process.env): Promise<ResultadoAvisos> {
  const alertas = await db.execute<{
    id: string;
    organizacao_id: string;
    tipo: TipoAlerta;
    texto: string;
    filtros: Record<string, string> | string;
    marca: string;
  }>(sql`
    select id, organizacao_id, tipo, texto, filtros,
           coalesce(ultimo_alerta_em, visto_em, created_at)::text as marca
      from busca_salva where alerta_ativo
  `);
  let avisos = 0;
  if (alertas.rows.length > 0) {
    const limite = lerLimiteComunidade(env.COMUNIDADE_VALOR_MINIMO);
    const perfis = new Map<string, Perfil | null>();
    const preparados = [];
    for (const a of alertas.rows) {
      const filtros = typeof a.filtros === "string" ? JSON.parse(a.filtros) : a.filtros;
      if (!perfis.has(a.organizacao_id)) perfis.set(a.organizacao_id, await obterPerfil(db, a.organizacao_id));
      preparados.push({
        id: a.id,
        marca: new Date(a.marca).getTime(),
        criterio: criterioDoAlerta({ tipo: a.tipo, parametros: { ...filtros, q: a.texto } }, perfis.get(a.organizacao_id) ?? null, limite),
      });
    }

    // Cursor (primeira_vez_em, número) em texto: um Date do JavaScript perderia os microssegundos.
    let cursor = { quando: alertas.rows.map((a) => a.marca).sort((x, y) => new Date(x).getTime() - new Date(y).getTime())[0], numero: "" };
    let ultima: string | null = null;
    for (;;) {
      const pagina = await db.execute<{
        numero: string;
        quando: string;
        objeto: string;
        orgao_nome: string;
        informacao_complementar: string | null;
        uf: string;
        municipio: string | null;
        modalidade_id: number;
        valor: string | number | null;
      }>(sql`
        select l.numero_controle_pncp as numero, l.primeira_vez_em::text as quando, l.objeto, l.orgao_nome,
               l.informacao_complementar, l.uf, l.municipio, l.modalidade_id, l.valor_estimado_centavos as valor
          from licitacao l
         where (l.primeira_vez_em, l.numero_controle_pncp) > (${cursor.quando}::timestamptz, ${cursor.numero})
         order by l.primeira_vez_em, l.numero_controle_pncp
         limit ${LOTE}
      `);
      if (pagina.rows.length === 0) break;
      const novos: { alerta: string; numero: string; motivo: string }[] = [];
      for (const l of pagina.rows) {
        const quando = new Date(l.quando).getTime();
        const licitacao = {
          objeto: l.objeto,
          orgao: l.orgao_nome,
          complemento: l.informacao_complementar,
          uf: l.uf,
          municipio: l.municipio,
          modalidadeId: l.modalidade_id,
          valorCentavos: l.valor == null ? null : Number(l.valor),
        };
        for (const a of preparados) {
          if (quando < a.marca) continue;
          const r = casar(a.criterio, licitacao);
          if (r.casa) novos.push({ alerta: a.id, numero: l.numero, motivo: r.motivo.slice(0, 500) });
        }
      }
      for (let i = 0; i < novos.length; i += 200) {
        const valores = novos.slice(i, i + 200).map((n) => sql`(${n.alerta}::uuid, ${n.numero}, ${n.motivo}, 'app')`);
        const gravados = await db.execute(sql`
          insert into aviso (busca_salva_id, numero_controle_pncp, motivo, canal)
          values ${sql.join(valores, sql`, `)}
          on conflict (busca_salva_id, numero_controle_pncp) do nothing
          returning id
        `);
        avisos += gravados.rows.length;
      }
      const fim = pagina.rows[pagina.rows.length - 1];
      cursor = { quando: fim.quando, numero: fim.numero };
      ultima = fim.quando;
      if (pagina.rows.length < LOTE) break;
    }
    if (ultima) {
      await db.execute(sql`
        update busca_salva set ultimo_alerta_em = ${ultima}::timestamptz
         where alerta_ativo and coalesce(ultimo_alerta_em, visto_em, created_at) < ${ultima}::timestamptz
      `);
    }
  }
  return { avisos, webhook: await enviarWebhook(db, env) };
}

/**
 * Notificação externa opcional: POST em ALERTA_WEBHOOK_URL com os avisos ainda não entregues
 * (das últimas 24 h). Tem tempo limite e nunca lança: falha aqui não derruba a ingestão; os
 * avisos continuam na tela e a entrega é tentada de novo na próxima passada.
 */
async function enviarWebhook(db: Db, env: Record<string, string | undefined>): Promise<ResultadoAvisos["webhook"]> {
  const url = env.ALERTA_WEBHOOK_URL?.trim();
  if (!url) return "desligado";
  try {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error("ALERTA_WEBHOOK_URL precisa ser http(s)");
    const tempoLimite = Math.min(30_000, Math.max(500, Number.parseInt(env.ALERTA_WEBHOOK_TIMEOUT_MS ?? "", 10) || 5_000));
    let enviou = false;
    // No máximo 4 remessas de 50 por passada, para não segurar a ingestão.
    for (let remessa = 0; remessa < 4; remessa++) {
      const r = await db.execute<{
        id: string;
        created_at: string | Date;
        motivo: string;
        alerta_id: string;
        nome: string;
        tipo: string;
        numero: string;
        objeto: string;
        orgao_nome: string;
        uf: string;
        municipio: string | null;
        modalidade: string;
        valor: string | number | null;
        data_encerramento: string | Date | null;
        cnpj_orgao: string;
        ano: number;
        sequencial: number;
      }>(sql`
        select a.id, a.created_at, a.motivo, b.id as alerta_id, b.nome, b.tipo,
               l.numero_controle_pncp as numero, l.objeto, l.orgao_nome, l.uf, l.municipio, m.nome as modalidade,
               l.valor_estimado_centavos as valor, l.data_encerramento, l.cnpj_orgao, l.ano, l.sequencial
          from aviso a
          join busca_salva b on b.id = a.busca_salva_id
          join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
          join modalidade m on m.id = l.modalidade_id
         where a.enviado_em is null and a.created_at > now() - interval '24 hours'
         order by a.created_at, a.id
         limit 50
      `);
      if (r.rows.length === 0) break;
      const pendentes: AvisoParaWebhook[] = r.rows.map((a) => ({
        id: a.id,
        criadoEm: new Date(a.created_at),
        motivo: a.motivo,
        alerta: { id: a.alerta_id, nome: a.nome, tipo: a.tipo },
        licitacao: {
          numeroControle: a.numero,
          objeto: a.objeto,
          orgao: a.orgao_nome,
          uf: a.uf,
          municipio: a.municipio,
          modalidade: a.modalidade,
          valorCentavos: a.valor == null ? null : Number(a.valor),
          encerramento: a.data_encerramento == null ? null : new Date(a.data_encerramento),
          cnpj: a.cnpj_orgao,
          ano: a.ano,
          sequencial: a.sequencial,
        },
      }));
      const resposta = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "ls-busca-alertas" },
        body: JSON.stringify(montarCorpoWebhook(pendentes, new Date())),
        signal: AbortSignal.timeout(tempoLimite),
        redirect: "error",
      });
      if (!resposta.ok) throw new Error(`o destino respondeu ${resposta.status}`);
      const ids = sql.join(pendentes.map((p) => sql`${p.id}::uuid`), sql`, `);
      await db.execute(sql`update aviso set enviado_em = now() where id in (${ids})`);
      enviou = true;
    }
    return enviou ? "enviado" : "nada";
  } catch (erro) {
    console.warn("[alertas] Webhook não entregue (os avisos continuam na tela):", erro instanceof Error ? erro.message : erro);
    return "falhou";
  }
}
