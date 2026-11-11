export type DonoDaTrava = {
  pid: number;
  porta?: number | string | null;
  hostname?: string;
  inicio?: string;
  rotulo?: string;
  comando?: string;
};

export class ErroBancoEmUso extends Error {
  code: "BANCO_EM_USO";
  dono: DonoDaTrava | null;
}

export function pastaDeDados(raiz?: string): string;
export function caminhoDaTrava(pasta: string): string;
export function processoVivo(pid: number): boolean;
export function lerTrava(pasta: string): DonoDaTrava | { ilegivel: true } | null;
export function situacaoDaTrava(pasta: string): { estado: "livre" | "viva" | "orfa" | "ilegivel"; dono: DonoDaTrava | null };
export function descreverDono(dono: DonoDaTrava | null): string;
export function aoEncerrar(fn: () => unknown | Promise<unknown>): () => void;
export function adquirirTrava(
  pasta: string,
  opcoes?: { rotulo?: string; porta?: number | string | null; aviso?: (mensagem: string) => void },
): { arquivo: string; soltar: () => void };
export function portaOcupada(porta: number, host?: string): Promise<boolean>;
export function motivosParaNaoAbrir(pasta: string, portas?: number[]): Promise<string[]>;
