import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { contrato } from "./schema";

export type NovoContrato = {
  tipo: "contrato" | "ata";
  numero: string;
  orgaoNome: string;
  orgaoCnpj?: string | null;
  objeto: string;
  valorTotalCentavos?: number | null;
  dataInicio: string; // yyyy-MM-dd
  dataFim: string;    // yyyy-MM-dd
  numeroControlePncp?: string | null;
  linkExterno?: string | null;
  notas?: string | null;
};

export type StatusContrato = "vigente" | "vencendo" | "vencido";

export function statusDoContrato(dataFim: string, hoje: string): { status: StatusContrato; diasRestantes: number } {
  const fim = new Date(dataFim).getTime();
  const h = new Date(hoje).getTime();
  const diff = Math.ceil((fim - h) / 86_400_000);
  if (diff < 0) return { status: "vencido", diasRestantes: diff };
  if (diff <= 30) return { status: "vencendo", diasRestantes: diff };
  return { status: "vigente", diasRestantes: diff };
}

export async function listarContratos(db: Db, organizacaoId: string) {
  return db.select().from(contrato)
    .where(eq(contrato.organizacaoId, organizacaoId))
    .orderBy(sql`${contrato.dataFim} asc`);
}

export async function criarContrato(db: Db, organizacaoId: string, dados: NovoContrato) {
  const [criado] = await db.insert(contrato).values({
    organizacaoId,
    tipo: dados.tipo,
    numero: dados.numero,
    orgaoNome: dados.orgaoNome,
    orgaoCnpj: dados.orgaoCnpj ?? null,
    objeto: dados.objeto,
    valorTotalCentavos: dados.valorTotalCentavos ?? null,
    valorAtualCentavos: dados.valorTotalCentavos ?? null,
    dataInicio: dados.dataInicio,
    dataFim: dados.dataFim,
    numeroControlePncp: dados.numeroControlePncp ?? null,
    linkExterno: dados.linkExterno ?? null,
    notas: dados.notas ?? null,
  }).returning();
  return criado;
}

export async function removerContrato(db: Db, organizacaoId: string, id: string) {
  await db.delete(contrato).where(and(eq(contrato.id, id), eq(contrato.organizacaoId, organizacaoId)));
}

export async function atualizarAditivo(db: Db, organizacaoId: string, id: string, novoValorCentavos: number, novaDataFim: string) {
  await db.update(contrato)
    .set({ valorAtualCentavos: novoValorCentavos, dataFim: novaDataFim, aditivos: sql`${contrato.aditivos} + 1` })
    .where(and(eq(contrato.id, id), eq(contrato.organizacaoId, organizacaoId)));
}
