import { sql } from "drizzle-orm";
import type { Db } from "./db";

export type PrazoDoBanco = {
  id: string;
  tipo: "encerramento" | "manual";
  /** Só prazos criados pela equipe podem ser apagados. */
  prazoId: string | null;
  titulo: string;
  quando: Date;
  objeto: string;
  href: string;
};

/**
 * Agenda da organização: fim das propostas (PNCP), prazo da etapa e prazos criados pela equipe,
 * das licitações acompanhadas que ainda estão em jogo. Mostra até 30 dias para trás (atrasados).
 */
export async function listarPrazos(db: Db, organizacaoId: string): Promise<PrazoDoBanco[]> {
  const r = await db.execute<{
    id: string;
    tipo: "encerramento" | "manual";
    prazo_id: string | null;
    titulo: string;
    quando: string | Date;
    objeto: string;
    cnpj_orgao: string;
    ano: number;
    sequencial: number;
  }>(sql`
    with cartoes as (
      select a.id, a.prazo_etapa, l.data_encerramento, l.objeto, l.cnpj_orgao, l.ano, l.sequencial
        from acompanhamento a
        join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
       where a.organizacao_id = ${organizacaoId}
         and a.etapa not in ('ganhou', 'perdeu', 'desistiu')
    ), eventos as (
      select 'enc-' || c.id as id, 'encerramento' as tipo, null::uuid as prazo_id,
             'Fim do envio de propostas' as titulo, c.data_encerramento as quando, c.id as cartao
        from cartoes c where c.data_encerramento is not null
      union all
      select 'eta-' || c.id, 'manual', null, 'Prazo da etapa', c.prazo_etapa, c.id
        from cartoes c where c.prazo_etapa is not null
      union all
      select 'pra-' || p.id, 'manual', p.id, p.titulo, p.quando, c.id
        from prazo p join cartoes c on c.id = p.acompanhamento_id
    )
    select e.id, e.tipo, e.prazo_id, e.titulo, e.quando, c.objeto, c.cnpj_orgao, c.ano, c.sequencial
      from eventos e join cartoes c on c.id = e.cartao
     where e.quando > now() - interval '30 days'
     order by e.quando
     limit 500
  `);
  return r.rows.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    prazoId: e.prazo_id,
    titulo: e.titulo,
    quando: new Date(e.quando),
    objeto: e.objeto,
    href: `/licitacao/${e.cnpj_orgao}/${e.ano}/${e.sequencial}`,
  }));
}

/** Grava só se o cartão for da organização de quem pediu. */
export async function adicionarPrazo(
  db: Db,
  organizacaoId: string,
  entrada: { acompanhamentoId: string; titulo: string; quando: Date },
) {
  const r = await db.execute(sql`
    insert into prazo (acompanhamento_id, titulo, quando)
    select a.id, ${entrada.titulo}, ${entrada.quando}
      from acompanhamento a
     where a.id = ${entrada.acompanhamentoId} and a.organizacao_id = ${organizacaoId}
    returning id
  `);
  return r.rows.length > 0;
}

export async function removerPrazo(db: Db, organizacaoId: string, prazoId: string) {
  await db.execute(sql`
    delete from prazo p using acompanhamento a
     where p.id = ${prazoId} and a.id = p.acompanhamento_id and a.organizacao_id = ${organizacaoId}
  `);
}
