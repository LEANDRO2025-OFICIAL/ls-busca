import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { acompanhamento, mudancaEtapa } from "./schema";

import { ETAPAS, type EtapaId } from "@/lib/etapas";

export { ETAPAS };
export type Etapa = EtapaId;

export type CartaoDoBanco = {
  id: string;
  etapa: Etapa;
  prioridade: 1 | 2 | 3;
  tags: string[];
  versao: number;
  objeto: string;
  orgaoUf: string;
  href: string;
  prazoISO: string | null;
};

export async function listarCartoes(db: Db, organizacaoId: string): Promise<CartaoDoBanco[]> {
  const r = await db.execute<{
    id: string;
    etapa: Etapa;
    prioridade: number;
    tags: string[] | null;
    versao: number;
    objeto: string;
    orgao_nome: string;
    uf: string;
    cnpj_orgao: string;
    ano: number;
    sequencial: number;
    prazo: string | Date | null;
  }>(sql`
    select a.id, a.etapa, a.prioridade, a.tags, a.versao,
           l.objeto, l.orgao_nome, l.uf, l.cnpj_orgao, l.ano, l.sequencial,
           coalesce(a.prazo_etapa, l.data_encerramento) as prazo
      from acompanhamento a
      join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
     where a.organizacao_id = ${organizacaoId}
     order by a.etapa, a.posicao, a.created_at
  `);
  return r.rows.map((c) => ({
    id: c.id,
    etapa: c.etapa,
    prioridade: ([1, 2, 3].includes(c.prioridade) ? c.prioridade : 2) as 1 | 2 | 3,
    tags: c.tags ?? [],
    versao: c.versao,
    objeto: c.objeto,
    orgaoUf: `${c.orgao_nome} · ${c.uf}`,
    href: `/licitacao/${c.cnpj_orgao}/${c.ano}/${c.sequencial}`,
    prazoISO: c.prazo == null ? null : new Date(c.prazo).toISOString(),
  }));
}

/** Coloca a licitação na Triagem. Idempotente: clicar duas vezes não duplica. */
export async function acompanhar(db: Db, organizacaoId: string, usuarioId: string, numeroControle: string) {
  const [novo] = await db
    .insert(acompanhamento)
    .values({ organizacaoId, numeroControlePncp: numeroControle, criadoPor: usuarioId })
    .onConflictDoNothing({ target: [acompanhamento.organizacaoId, acompanhamento.numeroControlePncp] })
    .returning({ id: acompanhamento.id });
  if (novo) {
    await db.insert(mudancaEtapa).values({ acompanhamentoId: novo.id, de: null, para: "interesse", usuarioId });
  }
  return { criado: Boolean(novo) };
}

export type ResultadoMover = { ok: true; versao: number } | { ok: false; motivo: "conflito" };

/** Muda a etapa com trava otimista: só grava se ninguém mexeu no cartão desde que ele foi lido. */
export async function moverCartao(
  db: Db,
  organizacaoId: string,
  usuarioId: string,
  entrada: { id: string; etapa: Etapa; versao: number },
): Promise<ResultadoMover> {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select({ etapa: acompanhamento.etapa })
      .from(acompanhamento)
      .where(and(eq(acompanhamento.id, entrada.id), eq(acompanhamento.organizacaoId, organizacaoId)));
    const [depois] = await tx
      .update(acompanhamento)
      .set({ etapa: entrada.etapa, versao: sql`${acompanhamento.versao} + 1` })
      .where(
        and(
          eq(acompanhamento.id, entrada.id),
          eq(acompanhamento.organizacaoId, organizacaoId),
          eq(acompanhamento.versao, entrada.versao),
        ),
      )
      .returning({ versao: acompanhamento.versao });
    if (!depois || !antes) return { ok: false, motivo: "conflito" } as const;
    await tx
      .insert(mudancaEtapa)
      .values({ acompanhamentoId: entrada.id, de: antes.etapa, para: entrada.etapa, usuarioId });
    return { ok: true, versao: depois.versao } as const;
  });
}
