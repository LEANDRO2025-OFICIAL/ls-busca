import type { PGlite, PGliteOptions } from "@electric-sql/pglite";

export type Executor = {
  exec(sql: string): Promise<void>;
  consulta<T>(sql: string, parametros?: unknown[]): Promise<T[]>;
  emTransacao(fn: (tx: Executor) => Promise<void>): Promise<void>;
};
export function pastaDeMigracoes(raiz?: string): string;
export function migracoesPendentes(banco: Executor, pasta?: string): Promise<string[]>;
export function aplicarMigracoes(banco: Executor, pasta?: string): Promise<string[]>;
export function executorPglite(cliente: PGlite): Executor;
export function abrirPglite(pasta: string, opcoes?: PGliteOptions): Promise<PGlite>;
