// Leitura e escrita de valores sem ponto flutuante: tudo vira inteiro (centavos ou centésimos de %).
import type { Criterio } from "./tipos.ts";

/** Maior valor aceito (R$ 100 bilhões em centavos): muito abaixo do limite de inteiros exatos. */
export const VALOR_MAXIMO = 10_000_000_000_000;

/**
 * Lê um número decimal escrito à brasileira ("1.234,56", "1234,5", "1234") e devolve o inteiro
 * em centésimos. Devolve null se o texto não for um número com no máximo duas casas.
 */
export function lerCentesimos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, "").replace(/\s*%$/, "").replace(/\s/g, "");
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(limpo);
  if (!m) return null;
  const inteiro = m[1].replace(/\./g, "");
  if (inteiro.length > 12) return null;
  return Number(inteiro) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

function agrupar(inteiro: string) {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 123456 → "1.234,56" */
export function escreverCentesimos(valor: number): string {
  const sinal = valor < 0 ? "-" : "";
  const abs = Math.abs(valor);
  return `${sinal}${agrupar(String(Math.trunc(abs / 100)))},${String(abs % 100).padStart(2, "0")}`;
}

export function formatarValor(valor: number, criterio: Criterio): string {
  return criterio === "maior_desconto" ? `${escreverCentesimos(valor)}%` : `R$ ${escreverCentesimos(valor)}`;
}

export function formatarDuracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.trunc(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** floor(valor × centésimos de % ÷ 10.000), exato (BigInt) mesmo para valores grandes. */
export function fracao(valor: number, centesimosDePorcento: number): number {
  return Number((BigInt(Math.abs(valor)) * BigInt(centesimosDePorcento)) / BigInt(10_000));
}
