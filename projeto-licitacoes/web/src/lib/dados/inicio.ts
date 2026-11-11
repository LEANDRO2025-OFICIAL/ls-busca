import { sql } from "drizzle-orm";
import type { Db } from "./db";

const FUSO = "America/Sao_Paulo";

/** Licitações abertas agora: total, as que encerram hoje, valor somado e as publicadas em hoje, 7 e 30 dias. */
export async function panoramaDaBase(db: Db) {
  const r = await db.execute<{
    abertas: string | number;
    encerram_hoje: string | number;
    valor_centavos: string | number;
    hoje: string | number;
    semana: string | number;
    mes: string | number;
  }>(sql`
    with h as (select (now() at time zone ${FUSO})::date as dia)
    select count(*) as abertas,
           count(*) filter (where (l.data_encerramento at time zone ${FUSO})::date = h.dia) as encerram_hoje,
           coalesce(sum(l.valor_estimado_centavos), 0) as valor_centavos,
           count(*) filter (where (l.data_publicacao at time zone ${FUSO})::date = h.dia) as hoje,
           count(*) filter (where (l.data_publicacao at time zone ${FUSO})::date > h.dia - 7) as semana,
           count(*) filter (where (l.data_publicacao at time zone ${FUSO})::date > h.dia - 30) as mes
      from licitacao l cross join h
     where l.data_encerramento > now()
  `);
  const l = r.rows[0];
  return {
    abertas: Number(l?.abertas ?? 0),
    encerramHoje: Number(l?.encerram_hoje ?? 0),
    valorCentavos: Number(l?.valor_centavos ?? 0),
    publicadasHoje: Number(l?.hoje ?? 0),
    publicadasSemana: Number(l?.semana ?? 0),
    publicadasMes: Number(l?.mes ?? 0),
  };
}

/** Números do funil da empresa: o que ainda está em jogo, o que já vai para disputa e o que foi ganho. */
export async function resumoDoFunil(db: Db, organizacaoId: string) {
  const r = await db.execute<{
    em_andamento: string | number;
    valor_andamento: string | number;
    para_disputar: string | number;
    valor_disputar: string | number;
    ganhos: string | number;
    valor_ganho: string | number;
  }>(sql`
    select count(*) filter (where a.etapa not in ('ganhou', 'perdeu', 'desistiu')) as em_andamento,
           coalesce(sum(l.valor_estimado_centavos) filter (where a.etapa not in ('ganhou', 'perdeu', 'desistiu')), 0) as valor_andamento,
           count(*) filter (where a.etapa in ('decidido_participar', 'proposta_enviada', 'sessao_hoje', 'em_disputa')) as para_disputar,
           coalesce(sum(l.valor_estimado_centavos) filter (where a.etapa in ('decidido_participar', 'proposta_enviada', 'sessao_hoje', 'em_disputa')), 0) as valor_disputar,
           count(*) filter (where a.etapa = 'ganhou') as ganhos,
           coalesce(sum(l.valor_estimado_centavos) filter (where a.etapa = 'ganhou'), 0) as valor_ganho
      from acompanhamento a
      join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
     where a.organizacao_id = ${organizacaoId}
  `);
  const l = r.rows[0];
  return {
    emAndamento: Number(l?.em_andamento ?? 0),
    valorAndamentoCentavos: Number(l?.valor_andamento ?? 0),
    paraDisputar: Number(l?.para_disputar ?? 0),
    valorDisputarCentavos: Number(l?.valor_disputar ?? 0),
    ganhos: Number(l?.ganhos ?? 0),
    valorGanhoCentavos: Number(l?.valor_ganho ?? 0),
  };
}

export async function nomeDaOrganizacao(db: Db, organizacaoId: string) {
  const r = await db.execute<{ nome: string }>(sql`select nome from organizacao where id = ${organizacaoId}`);
  return r.rows[0]?.nome ?? "";
}
