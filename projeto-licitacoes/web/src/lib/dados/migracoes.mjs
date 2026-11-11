// Aplicação das migrações SQL (src/db/migracoes/*.sql), igual para PGlite e Postgres.
// .mjs puro: usado por db.ts, pelos scripts e pelos testes.
import fs from "node:fs";
import path from "node:path";

export function pastaDeMigracoes(raiz = process.cwd()) {
  return path.join(raiz, "src", "db", "migracoes");
}

/**
 * @typedef {{ exec(sql: string): Promise<void>, consulta(sql: string, p?: unknown[]): Promise<any[]>,
 *             emTransacao(fn: (tx: any) => Promise<void>): Promise<void> }} Executor
 */

/** Nomes das migrações que ainda não rodaram neste banco, em ordem. */
export async function migracoesPendentes(banco, pasta = pastaDeMigracoes()) {
  await banco.exec(`create table if not exists _migracao (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`);
  const aplicadas = new Set((await banco.consulta("select nome from _migracao")).map((r) => r.nome));
  // turbopackIgnore: a pasta vem por parâmetro; sem isto o empacotador rastreia o projeto inteiro.
  return fs
    .readdirSync(/* turbopackIgnore: true */ pasta)
    .filter((a) => a.endsWith(".sql"))
    .sort()
    .filter((a) => !aplicadas.has(a));
}

/** Aplica as pendentes, cada uma em sua transação. Devolve os nomes aplicados. */
export async function aplicarMigracoes(banco, pasta = pastaDeMigracoes()) {
  const pendentes = await migracoesPendentes(banco, pasta);
  for (const arquivo of pendentes) {
    const conteudo = fs.readFileSync(path.join(/* turbopackIgnore: true */ pasta, arquivo), "utf8");
    await banco.emTransacao(async (tx) => {
      await tx.exec(conteudo);
      await tx.consulta("insert into _migracao (nome) values ($1)", [arquivo]);
    });
  }
  return pendentes;
}

/** Envolve um cliente PGlite no formato que as funções acima esperam. */
export function executorPglite(cliente) {
  const envolver = (c) => ({
    exec: async (s) => void (await c.exec(s)),
    consulta: async (s, p) => (await c.query(s, p)).rows,
  });
  return {
    ...envolver(cliente),
    emTransacao: (fn) => cliente.transaction(async (tx) => fn({ ...envolver(tx), emTransacao: () => Promise.reject(new Error("transação aninhada")) })),
  };
}

/** Abre o PGlite com as extensões que o esquema usa. Quem chama já deve segurar a trava. */
export async function abrirPglite(pasta, opcoes = {}) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { unaccent } = await import("@electric-sql/pglite/contrib/unaccent");
  fs.mkdirSync(pasta, { recursive: true });
  const cliente = new PGlite(pasta, { extensions: { pg_trgm, unaccent }, ...opcoes });
  await cliente.waitReady;
  return cliente;
}
