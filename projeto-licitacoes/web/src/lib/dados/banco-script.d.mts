import type { PGlite } from "@electric-sql/pglite";

export const SAIDA_BANCO_EM_USO: 2;
export function urlDoPostgres(raiz?: string, env?: Record<string, string | undefined>): string | null;
export function prepararScript(opcoes: { rotulo: string }): Promise<{ pasta: string; trava: { arquivo: string; soltar(): void } }>;
export function abrirBancoDoScript(pasta: string): Promise<{ cliente: PGlite; fechar(): Promise<void> }>;
