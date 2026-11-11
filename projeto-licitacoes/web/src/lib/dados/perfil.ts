import { sql, type SQL } from "drizzle-orm";
import type { Db } from "./db";

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export type Perfil = {
  termos: string[];
  termosExcluidos: string[];
  ufs: string[];
  modalidades: number[];
};

/**
 * Lista de texto como parâmetro único (JSON), convertida em array no Postgres.
 * O template do Drizzle expandiria um array JS em vários parâmetros.
 */
export function listaTexto(valores: readonly string[]): SQL {
  return sql`array(select jsonb_array_elements_text(${JSON.stringify(valores)}::jsonb))`;
}

export async function obterPerfil(db: Db, organizacaoId: string): Promise<Perfil | null> {
  const r = await db.execute<{
    termos: string[] | null;
    termos_excluidos: string[] | null;
    ufs: string[] | null;
    modalidades: number[] | null;
  }>(sql`
    select termos, termos_excluidos, ufs, modalidades
      from perfil_ramo where organizacao_id = ${organizacaoId}
  `);
  const p = r.rows[0];
  if (!p) return null;
  return {
    termos: p.termos ?? [],
    termosExcluidos: p.termos_excluidos ?? [],
    ufs: (p.ufs ?? []).map((u) => u.trim()),
    modalidades: p.modalidades ?? [],
  };
}

export async function salvarPerfil(db: Db, organizacaoId: string, p: Perfil) {
  await db.execute(sql`
    insert into perfil_ramo (organizacao_id, termos, termos_excluidos, ufs, modalidades)
    values (
      ${organizacaoId},
      ${listaTexto(p.termos)},
      ${listaTexto(p.termosExcluidos)},
      ${listaTexto(p.ufs)}::char(2)[],
      ${listaTexto(p.modalidades.map(String))}::int[]
    )
    on conflict (organizacao_id) do update set
      termos = excluded.termos,
      termos_excluidos = excluded.termos_excluidos,
      ufs = excluded.ufs,
      modalidades = excluded.modalidades
  `);
}

export async function listarModalidades(db: Db) {
  const r = await db.execute<{ id: number; nome: string }>(sql`select id, nome from modalidade order by nome`);
  return r.rows;
}
