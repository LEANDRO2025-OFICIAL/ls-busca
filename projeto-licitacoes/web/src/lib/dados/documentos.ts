import { sql } from "drizzle-orm";
import { DIAS_AVISO } from "@/lib/empresa";
import type { Db } from "./db";

const FUSO = "America/Sao_Paulo";

export type Documento = {
  id: string;
  tipo: string;
  nome: string;
  numero: string | null;
  /** AAAA-MM-DD */
  validade: string | null;
  observacao: string | null;
};

export async function listarDocumentos(db: Db, organizacaoId: string): Promise<Documento[]> {
  const r = await db.execute<Documento>(sql`
    select id, tipo, nome, numero, to_char(validade, 'YYYY-MM-DD') as validade, observacao
      from documento_empresa
     where organizacao_id = ${organizacaoId}
     order by validade nulls last, nome
  `);
  return r.rows;
}

export async function criarDocumento(db: Db, organizacaoId: string, d: Omit<Documento, "id">) {
  await db.execute(sql`
    insert into documento_empresa (organizacao_id, tipo, nome, numero, validade, observacao)
    values (${organizacaoId}, ${d.tipo}, ${d.nome}, ${d.numero}, ${d.validade}, ${d.observacao})
  `);
}

/** Grava só se o documento for da organização de quem pediu. */
export async function renovarDocumento(db: Db, organizacaoId: string, id: string, validade: string) {
  await db.execute(sql`
    update documento_empresa set validade = ${validade}, updated_at = now()
     where id = ${id} and organizacao_id = ${organizacaoId}
  `);
}

export async function removerDocumento(db: Db, organizacaoId: string, id: string) {
  await db.execute(sql`delete from documento_empresa where id = ${id} and organizacao_id = ${organizacaoId}`);
}

/** Quantos documentos já venceram e quantos vencem nos próximos DIAS_AVISO dias. */
export async function resumoDocumentos(db: Db, organizacaoId: string) {
  const r = await db.execute<{ vencidos: string | number; vencendo: string | number }>(sql`
    with h as (select (now() at time zone ${FUSO})::date as dia)
    select count(*) filter (where d.validade < h.dia) as vencidos,
           count(*) filter (where d.validade >= h.dia and d.validade <= h.dia + ${DIAS_AVISO}::int) as vencendo
      from documento_empresa d cross join h
     where d.organizacao_id = ${organizacaoId}
  `);
  return { vencidos: Number(r.rows[0]?.vencidos ?? 0), vencendo: Number(r.rows[0]?.vencendo ?? 0) };
}
