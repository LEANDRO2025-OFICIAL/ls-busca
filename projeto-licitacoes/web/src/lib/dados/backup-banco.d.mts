export type Backup = { nome: string; caminho: string; tipo: "pasta" | "dump"; motivo: string; quando: Date };
export type BackupFeito = { nome: string; caminho: string; tipo: "pasta" | "dump"; apagados: string[] };
export function configuracaoDeBackup(env?: Record<string, string | undefined>): {
  ativo: boolean;
  retencao: number;
  intervaloHoras: number;
  dumpMaxMb: number;
};
export function pastaDeBackups(pastaDados: string): string;
export function bancoExiste(pastaDados: string): boolean;
export function tamanhoEmBytes(caminho: string): number;
export function listarBackups(pastaDados: string): Backup[];
export function horasDesdeOUltimoBackup(pastaDados: string): number;
export function aplicarRetencao(pastaDados: string, manter?: number): string[];
export function copiarPastaFechada(pastaDados: string, motivo: string, opcoes?: { retencao?: number }): Promise<BackupFeito | null>;
export function gravarDump(
  cliente: { exec(sql: string): Promise<unknown>; dumpDataDir(c?: "gzip" | "none" | "auto"): Promise<Blob> },
  pastaDados: string,
  motivo: string,
  opcoes?: { retencao?: number },
): Promise<BackupFeito>;
export function restaurarPasta(pastaDados: string, backup: { caminho: string }): Promise<{ guardada: string | null }>;
export function moverPastaAtual(pastaDados: string): string | null;
