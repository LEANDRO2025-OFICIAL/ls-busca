import fs from "node:fs/promises";
import path from "node:path";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

// Com DATABASE_URL: Postgres gerenciado (Neon, Supabase...) pelo driver pg.
// Sem ela: Postgres 17 embutido (PGlite) em .data/pglite, só para desenvolvimento.
// O SQL das migrações e as consultas são os mesmos nos dois casos.

export type Db = PgliteDatabase<typeof schema>;

const PASTA_DADOS = path.join(process.cwd(), ".data", "pglite");
const PASTA_MIGRACOES = path.join(process.cwd(), "src", "db", "migracoes");

// Organização semeada só em desenvolvimento (dados antigos da fatia vertical).
export const ORG_DEV = "00000000-0000-4000-8000-000000000001";

/** O mínimo que as migrações precisam, igual para PGlite e pg. */
type Executor = {
  exec(sql: string): Promise<void>;
  consulta<T>(sql: string, parametros?: unknown[]): Promise<T[]>;
  emTransacao(fn: (tx: Executor) => Promise<void>): Promise<void>;
};

// Uma instância por processo: o PGlite não aceita dois clientes na mesma pasta,
// e o recarregamento do Next em dev reexecutaria este módulo.
const global = globalThis as unknown as { __db?: Promise<Db> };

export function obterDb(): Promise<Db> {
  global.__db ??= iniciar().catch((erro) => {
    global.__db = undefined;
    throw erro;
  });
  return global.__db;
}

async function iniciar(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  return url ? iniciarPostgres(url) : iniciarPglite();
}

async function iniciarPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { unaccent } = await import("@electric-sql/pglite/contrib/unaccent");
  await fs.mkdir(PASTA_DADOS, { recursive: true });
  const cliente = new PGlite(PASTA_DADOS, { extensions: { pg_trgm, unaccent } });
  await cliente.waitReady;

  type Base = { exec(s: string): Promise<unknown>; query<T>(s: string, p?: unknown[]): Promise<{ rows: T[] }> };
  const envolver = (c: Base): Omit<Executor, "emTransacao"> => ({
    exec: async (s) => void (await c.exec(s)),
    consulta: async <T,>(s: string, p?: unknown[]) => (await c.query<T>(s, p)).rows,
  });
  const executor: Executor = {
    ...envolver(cliente),
    emTransacao: (fn) => cliente.transaction(async (tx) => fn({ ...envolver(tx), emTransacao: () => Promise.reject() })),
  };
  await prepararBanco(executor);
  return drizzle({ client: cliente, schema });
}

async function iniciarPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const { drizzle: drizzlePg } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: url, max: 5 });
  const executor: Executor = {
    exec: async (s) => void (await pool.query(s)),
    consulta: async <T,>(s: string, p?: unknown[]) => (await pool.query(s, p)).rows as T[],
    emTransacao: async (fn) => {
      const conexao = await pool.connect();
      try {
        await conexao.query("begin");
        await fn({
          exec: async (s) => void (await conexao.query(s)),
          consulta: async <T,>(s: string, p?: unknown[]) => (await conexao.query(s, p)).rows as T[],
          emTransacao: () => Promise.reject(),
        });
        await conexao.query("commit");
      } catch (erro) {
        await conexao.query("rollback");
        throw erro;
      } finally {
        conexao.release();
      }
    },
  };
  await prepararBanco(executor);
  // Mesma API do Drizzle usada pelo app (select/insert/update/execute/transaction; execute devolve { rows }).
  return drizzlePg({ client: pool, schema }) as unknown as Db;
}

async function prepararBanco(banco: Executor) {
  await banco.exec(`create table if not exists _migracao (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`);
  const aplicadas = new Set((await banco.consulta<{ nome: string }>("select nome from _migracao")).map((r) => r.nome));
  const arquivos = (await fs.readdir(PASTA_MIGRACOES)).filter((a) => a.endsWith(".sql")).sort();
  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    const conteudo = await fs.readFile(path.join(PASTA_MIGRACOES, arquivo), "utf8");
    await banco.emTransacao(async (tx) => {
      await tx.exec(conteudo);
      await tx.consulta("insert into _migracao (nome) values ($1)", [arquivo]);
    });
  }
  if (process.env.NODE_ENV !== "production") {
    await banco.consulta(
      `insert into organizacao (id, nome) values ($1, 'Organização de desenvolvimento') on conflict (id) do nothing`,
      [ORG_DEV],
    );
  }
}
