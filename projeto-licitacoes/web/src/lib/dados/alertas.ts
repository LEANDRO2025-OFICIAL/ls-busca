import { sql } from "drizzle-orm";
import { lerFiltros } from "@/lib/filtros-busca";
import { buscarLicitacoes } from "./busca";
import type { Db } from "./db";
import type { Perfil } from "./perfil";

export type BuscaSalva = {
  id: string;
  nome: string;
  /** Parâmetros da URL da busca (q, uf, mod...), já validados ao salvar. */
  parametros: Record<string, string>;
  vistoEm: Date;
};

export async function salvarBusca(
  db: Db,
  organizacaoId: string,
  usuarioId: string,
  entrada: { nome: string; parametros: Record<string, string> },
) {
  const { q = "", ...filtros } = entrada.parametros;
  await db.execute(sql`
    insert into busca_salva (organizacao_id, usuario_id, nome, texto, filtros, alerta_ativo)
    values (${organizacaoId}, ${usuarioId}, ${entrada.nome}, ${q}, ${JSON.stringify(filtros)}::jsonb, true)
  `);
}

export async function listarBuscasSalvas(db: Db, organizacaoId: string): Promise<BuscaSalva[]> {
  const r = await db.execute<{
    id: string;
    nome: string;
    texto: string;
    filtros: Record<string, string> | string;
    visto_em: string | Date;
  }>(sql`
    select id, nome, texto, filtros, visto_em from busca_salva
     where organizacao_id = ${organizacaoId}
     order by created_at desc
     limit 50
  `);
  return r.rows.map((b) => {
    const filtros = typeof b.filtros === "string" ? JSON.parse(b.filtros) : b.filtros;
    return { id: b.id, nome: b.nome, parametros: { ...filtros, q: b.texto }, vistoEm: new Date(b.visto_em) };
  });
}

/** Filtros da busca salva e as licitações que entraram na base depois da última vez que ela foi vista. */
export async function novidadesDoAlerta(db: Db, organizacaoId: string, perfil: Perfil | null, b: BuscaSalva) {
  const f = lerFiltros(b.parametros);
  const novas = await buscarLicitacoes(db, organizacaoId, {
    q: f.q,
    uf: f.uf,
    modalidade: f.modalidade,
    valorMinCentavos: f.valorMin == null ? null : f.valorMin * 100,
    valorMaxCentavos: f.valorMax == null ? null : f.valorMax * 100,
    encerraEmDias: f.encerra,
    pagina: 1,
    perfil,
    apenasRamo: f.ramo && Boolean(perfil?.termos.length),
    novasDesde: b.vistoEm,
    aderenciaMin: f.aderencia,
  });
  return { f, novas };
}

export async function marcarBuscaVista(db: Db, organizacaoId: string, id: string) {
  await db.execute(sql`update busca_salva set visto_em = now() where id = ${id} and organizacao_id = ${organizacaoId}`);
}

export async function removerBusca(db: Db, organizacaoId: string, id: string) {
  await db.execute(sql`delete from busca_salva where id = ${id} and organizacao_id = ${organizacaoId}`);
}
