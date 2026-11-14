import { sql } from "drizzle-orm";
import { cifrar, decifrar } from "@/lib/fontes/crypto";
import type { FonteId, LicitacaoExterna, ResumoFonte, StatusConexao } from "@/lib/fontes/types";
import type { Db } from "./db";

type RowCredencial = {
  fonte: string;
  login: string;
  senha_enc: string;
  token: string | null;
  token_expira_em: string | null;
  status: string;
  ultimo_erro: string | null;
  ultima_sinc: string | null;
};

export async function listarStatusConexoes(db: Db, organizacaoId: string): Promise<StatusConexao[]> {
  const r = await db.execute<RowCredencial>(sql`
    select fonte, status, token_expira_em, ultima_sinc, ultimo_erro
    from credencial_fonte
    where organizacao_id = ${organizacaoId}
    order by fonte
  `);
  return r.rows.map((row) => ({
    fonte: row.fonte as FonteId,
    status: row.status as StatusConexao["status"],
    tokenExpiraEm: row.token_expira_em ? new Date(row.token_expira_em) : null,
    ultimaSinc: row.ultima_sinc ? new Date(row.ultima_sinc) : null,
    ultimoErro: row.ultimo_erro,
  }));
}

export async function salvarCredencial(
  db: Db,
  organizacaoId: string,
  fonte: FonteId,
  login: string,
  senha: string,
): Promise<void> {
  const senhaEnc = cifrar(senha);
  await db.execute(sql`
    insert into credencial_fonte (organizacao_id, fonte, login, senha_enc, status)
    values (${organizacaoId}, ${fonte}, ${login}, ${senhaEnc}, 'pendente')
    on conflict (organizacao_id, fonte) do update
      set login = excluded.login, senha_enc = excluded.senha_enc,
          status = 'pendente', ultimo_erro = null, updated_at = now()
  `);
}

export async function salvarTokenFonte(
  db: Db,
  organizacaoId: string,
  fonte: FonteId,
  token: string,
  expiraEm: Date | null,
): Promise<void> {
  const tokenEnc = cifrar(token);
  await db.execute(sql`
    update credencial_fonte
    set token = ${tokenEnc}, token_expira_em = ${expiraEm?.toISOString() ?? null}, status = 'ativa',
        ultimo_erro = null, ultima_sinc = now(), updated_at = now()
    where organizacao_id = ${organizacaoId} and fonte = ${fonte}
  `);
}

export async function lerCredencial(
  db: Db,
  organizacaoId: string,
  fonte: FonteId,
): Promise<{ login: string; senha: string; token: string | null; tokenExpiraEm: Date | null } | null> {
  const r = await db.execute<RowCredencial>(sql`
    select login, senha_enc, token, token_expira_em
    from credencial_fonte
    where organizacao_id = ${organizacaoId} and fonte = ${fonte} and status != 'desativada'
  `);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    login: row.login,
    senha: decifrar(row.senha_enc),
    token: row.token ? decifrar(row.token) : null,
    tokenExpiraEm: row.token_expira_em ? new Date(row.token_expira_em) : null,
  };
}

export async function marcarErroFonte(
  db: Db,
  organizacaoId: string,
  fonte: FonteId,
  erro: string,
): Promise<void> {
  await db.execute(sql`
    update credencial_fonte
    set status = 'erro', ultimo_erro = ${erro}, updated_at = now()
    where organizacao_id = ${organizacaoId} and fonte = ${fonte}
  `);
}

export async function salvarResumoFonte(
  db: Db,
  organizacaoId: string,
  fonte: FonteId,
  resumo: ResumoFonte,
): Promise<void> {
  await db.execute(sql`
    insert into resumo_fonte (organizacao_id, fonte, total_abertas, total_favoritas,
      boletins_nao_lidos, notificacoes_nao_lidas, capturado_em)
    values (${organizacaoId}, ${fonte}, ${resumo.totalAbertas}, ${resumo.totalFavoritas},
      ${resumo.boletinsNaoLidos}, ${resumo.notificacoesNaoLidas}, now())
    on conflict (organizacao_id, fonte) do update
      set total_abertas = excluded.total_abertas,
          total_favoritas = excluded.total_favoritas,
          boletins_nao_lidos = excluded.boletins_nao_lidos,
          notificacoes_nao_lidas = excluded.notificacoes_nao_lidas,
          capturado_em = now()
  `);
}

type RowResumo = {
  total_abertas: number | null;
  total_favoritas: number | null;
  boletins_nao_lidos: number | null;
  notificacoes_nao_lidas: number | null;
  capturado_em: string | null;
};

export async function lerResumoFonte(
  db: Db,
  organizacaoId: string,
  fonte: FonteId,
): Promise<ResumoFonte | null> {
  const r = await db.execute<RowResumo>(sql`
    select total_abertas, total_favoritas, boletins_nao_lidos, notificacoes_nao_lidas, capturado_em
    from resumo_fonte
    where organizacao_id = ${organizacaoId} and fonte = ${fonte}
  `);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    totalAbertas: row.total_abertas,
    totalFavoritas: row.total_favoritas,
    boletinsNaoLidos: row.boletins_nao_lidos,
    notificacoesNaoLidas: row.notificacoes_nao_lidas,
    capturadoEm: row.capturado_em ? new Date(row.capturado_em) : null,
  };
}

export async function upsertLicitacaoExterna(
  db: Db,
  organizacaoId: string,
  items: LicitacaoExterna[],
): Promise<number> {
  let count = 0;
  for (const item of items) {
    if (!item.idExterno) continue;
    await db.execute(sql`
      insert into licitacao_externa (
        organizacao_id, fonte, id_externo, objeto, orgao, uf, valor_centavos,
        data_abertura, data_encerramento, status_ext, link_externo, cnaes, bruto
      ) values (
        ${organizacaoId}, ${item.fonte}, ${item.idExterno}, ${item.objeto}, ${item.orgao},
        ${item.uf}, ${item.valorCentavos},
        ${item.dataAbertura?.toISOString() ?? null}, ${item.dataEncerramento?.toISOString() ?? null},
        ${item.statusExt}, ${item.linkExterno}, ${item.cnaes}, ${JSON.stringify(item.bruto)}
      )
      on conflict (organizacao_id, fonte, id_externo) do update
        set objeto = excluded.objeto, orgao = excluded.orgao, uf = excluded.uf,
            valor_centavos = excluded.valor_centavos, data_abertura = excluded.data_abertura,
            data_encerramento = excluded.data_encerramento, status_ext = excluded.status_ext,
            link_externo = excluded.link_externo, cnaes = excluded.cnaes,
            bruto = excluded.bruto, updated_at = now()
    `);
    count++;
  }
  return count;
}
