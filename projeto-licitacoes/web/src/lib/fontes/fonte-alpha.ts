// Adaptador para Fonte Alpha.
import type { LicitacaoExterna, ResumoFonte } from "./types";

const BASE = "https://middleware.effecti.com.br";

export async function autenticarAlpha(
  login: string,
  senha: string,
): Promise<{ token: string; expiraEm: Date }> {
  for (const path of ["/auth/login", "/api/auth/login", "/minha/auth/login"]) {
    try {
      const r = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        body: JSON.stringify({ email: login, password: senha }),
      });
      if (r.status === 404) continue;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as Record<string, unknown>;
      const token = (data?.token ?? data?.accessToken ?? data?.access_token) as string | undefined;
      if (!token) throw new Error("Token não encontrado na resposta");
      return { token, expiraEm: new Date(Date.now() + 23 * 60 * 60 * 1000) };
    } catch (e) {
      if ((e as Error).message?.includes("404")) continue;
      throw e;
    }
  }
  throw new Error("ENDPOINT_NAO_ENCONTRADO: use o modo de token manual");
}

export async function validarTokenAlpha(token: string): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/general/data`, {
      headers: { "Authorization": `Bearer ${token}`, "User-Agent": "Mozilla/5.0" },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function buscarResumoAlpha(token: string): Promise<ResumoFonte> {
  const headers = { "Authorization": `Bearer ${token}`, "User-Agent": "Mozilla/5.0" };
  let totalAbertas: number | null = null;

  try {
    const r = await fetch(`${BASE}/minha/home/overview`, { headers });
    if (r.ok) {
      const data = await r.json() as Record<string, unknown>;
      totalAbertas = typeof data?.total === "number" ? data.total as number : null;
    }
  } catch { /* ignora */ }

  return {
    totalAbertas,
    totalFavoritas: null,
    boletinsNaoLidos: null,
    notificacoesNaoLidas: null,
    capturadoEm: new Date(),
  };
}

export async function buscarLicitacoesAlpha(token: string, page = 1): Promise<LicitacaoExterna[]> {
  const r = await fetch(`${BASE}/produto/pesquisar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ search: "", page, perPage: 50 }),
  });
  if (r.status === 401) throw new Error("TOKEN_EXPIRADO");
  if (!r.ok) return [];
  const data = await r.json() as unknown;
  const linhas: unknown[] = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.data as unknown[]) ?? [];
  return linhas.map((l) => normalizarAlpha(l as Record<string, unknown>));
}

function normalizarAlpha(l: Record<string, unknown>): LicitacaoExterna {
  const valorBruto = l.valor ?? l.valorEstimado ?? l.price;
  return {
    fonte: "alpha",
    idExterno: String(l.id ?? l.pregao_id ?? l.licitacao_id ?? ""),
    objeto: String(l.objeto ?? l.title ?? l.descricao ?? l.object ?? ""),
    orgao: String(l.orgao ?? l.entity ?? l.comprador ?? l.buyer ?? ""),
    uf: (String(l.uf ?? l.estado ?? "").slice(0, 2)) || null,
    valorCentavos: valorBruto != null ? Math.round(Number(valorBruto) * 100) : null,
    dataAbertura: l.data_abertura ? new Date(String(l.data_abertura)) : null,
    dataEncerramento: l.data_encerramento ? new Date(String(l.data_encerramento)) : null,
    statusExt: String(l.situacao ?? l.status ?? "aberta"),
    linkExterno: String(l.link ?? l.url ?? l.link_externo ?? "").replace(/^undefined$/, "") || null,
    cnaes: Array.isArray(l.cnaes) ? (l.cnaes as unknown[]).map(String) : [],
    bruto: l as Record<string, unknown>,
  };
}
