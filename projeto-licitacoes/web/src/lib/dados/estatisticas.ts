// Melhoria 3: preço de referência e mapa de concorrência a partir dos resultados ingeridos.
import { sql } from "drizzle-orm";
import type { Db } from "./db";

export type PrecoReferencia = {
  amostra: number;
  descontoMediano: number | null;
  descontoMedio: number | null;
};

export type ConcorrenteFrequente = {
  niFornecedor: string;
  nomeFornecedor: string;
  vitorias: number;
  totalCentavos: bigint;
};

/**
 * Desconto mediano e médio de resultados parecidos nos últimos 24 meses.
 * Retorna null se amostra < 5 (base insuficiente).
 */
export async function precoReferencia(
  db: Db,
  params: { uf: string; modalidade: string; objeto: string },
): Promise<PrecoReferencia | null> {
  type Row = { amostra: string | number; desconto_mediano: string | number | null; desconto_medio: string | number | null };
  const result = await db.execute<Row>(sql`
    select
      count(*) as amostra,
      percentile_cont(0.5) within group (order by desconto_centesimos) as desconto_mediano,
      avg(desconto_centesimos) as desconto_medio
    from resultado_licitacao
    where uf = ${params.uf}
      and modalidade = ${params.modalidade}
      and objeto ilike ${"%" + params.objeto + "%"}
      and data_resultado > now() - interval '24 months'
  `);
  const row = (result as unknown as { rows: Row[] }).rows?.[0];
  if (!row) return null;
  const amostra = Number(row.amostra);
  if (amostra < 5) return null;
  return {
    amostra,
    descontoMediano: row.desconto_mediano != null ? Number(row.desconto_mediano) : null,
    descontoMedio: row.desconto_medio != null ? Number(row.desconto_medio) : null,
  };
}

/** Top 10 fornecedores que mais vencem para um dado CNPJ de órgão. */
export async function mapaConcorrencia(
  db: Db,
  params: { orgaoCnpj: string },
): Promise<ConcorrenteFrequente[]> {
  const rows = await db.execute<{
    ni_fornecedor: string;
    nome_fornecedor: string;
    vitorias: string | number;
    total: string | number;
  }>(sql`
    select
      v.ni_fornecedor,
      v.nome_fornecedor,
      count(*) as vitorias,
      sum(v.valor_unitario_centavos) as total
    from resultado_item_vencedor v
    join resultado_licitacao r on r.numero_controle = v.numero_controle
    where r.orgao_cnpj = ${params.orgaoCnpj}
      and v.ni_fornecedor is not null
    group by v.ni_fornecedor, v.nome_fornecedor
    order by vitorias desc
    limit 10
  `);
  type Row2 = { ni_fornecedor: string; nome_fornecedor: string; vitorias: string | number; total: string | number };
  const lista = ((rows as unknown as { rows: Row2[] }).rows ?? (rows as unknown as Row2[])) as Row2[];
  return lista.map((r) => ({
    niFornecedor: r.ni_fornecedor,
    nomeFornecedor: r.nome_fornecedor,
    vitorias: Number(r.vitorias),
    totalCentavos: BigInt(r.total ?? 0),
  }));
}
