import { timingSafeEqual } from "node:crypto";

/**
 * Porta única de autorização das rotas de cron e diagnóstico.
 * Regra: a rota NUNCA fica aberta por falta de configuração. Sem CRON_SECRET, ela responde 503
 * (mal configurada) — nunca 200. A comparação é feita em tempo constante.
 */
export function autorizarCron(req: Request): { ok: true } | { ok: false; status: number; erro: string } {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || segredo.length < 16) {
    return { ok: false, status: 503, erro: "CRON_SECRET não configurado ou curto demais (mínimo 16 caracteres)." };
  }

  const cabecalho = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const a = Buffer.from(cabecalho);
  const b = Buffer.from(esperado);
  // timingSafeEqual exige buffers do mesmo tamanho; comparar tamanho antes não vaza o segredo.
  const iguais = a.length === b.length && timingSafeEqual(a, b);
  if (!iguais) return { ok: false, status: 401, erro: "não autorizado" };
  return { ok: true };
}
