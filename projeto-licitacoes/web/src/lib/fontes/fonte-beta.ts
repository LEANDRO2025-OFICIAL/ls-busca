// Adaptador para Fonte Beta.
import type { LicitacaoExterna, ResumoFonte } from "./types";

const BASE = "https://consultaonline.conlicitacao.com.br";
const SPA = "https://consulteonline.conlicitacao.com.br";

export type SessaoBeta = {
  cookies: Record<string, string>;
  companyId: string;
};

export async function autenticarBeta(
  login: string,
  senha: string,
): Promise<{ sessao: SessaoBeta; expiraEm: Date }> {
  const r = await fetch(`${BASE}/users/login.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": SPA,
      "Referer": SPA + "/",
    },
    body: JSON.stringify({ login, senha }),
    redirect: "manual",
  });

  if (r.status !== 200) throw new Error(`Autenticação falhou: HTTP ${r.status}`);

  const rawCookies = r.headers.getSetCookie?.() ?? [];
  const cookies: Record<string, string> = {};
  for (const c of rawCookies) {
    const part = c.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }

  const data = await r.json() as Record<string, unknown>;
  const companyId = String(
    (data?.user as Record<string, unknown>)?.client_id ??
    cookies["cnl-controle"] ??
    "",
  );

  if (!companyId) throw new Error("ID da empresa não encontrado na resposta");

  return {
    sessao: { cookies, companyId },
    expiraEm: new Date(Date.now() + 90 * 60 * 1000),
  };
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

function getJson(url: string, sessao: SessaoBeta) {
  return fetch(url, {
    headers: {
      "Accept": "application/json",
      "Cookie": cookieHeader(sessao.cookies),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
}

export async function buscarResumoBeta(sessao: SessaoBeta): Promise<ResumoFonte> {
  const cid = sessao.companyId;
  let totalAbertas: number | null = null;
  let totalFavoritas: number | null = null;
  let boletinsNaoLidos: number | null = null;
  let notificacoesNaoLidas: number | null = null;

  try {
    const r = await getJson(`${BASE}/biddings_overview?companyId=${cid}`, sessao);
    if (r.ok) {
      const d = await r.json() as Record<string, unknown>;
      totalAbertas = typeof d.total_biddings_future === "number" ? d.total_biddings_future as number : null;
    }
  } catch { /* ignora */ }

  try {
    const r = await getJson(`${BASE}/gerenciar_licitacoes/resumo.json?companyId=${cid}&scope=client`, sessao);
    if (r.ok) {
      const d = await r.json() as Record<string, unknown>;
      totalFavoritas = typeof d.total_favorites === "number" ? d.total_favorites as number : null;
    }
  } catch { /* ignora */ }

  try {
    const r = await getJson(`${BASE}/boletim_web/public/boletins/total_bulletin_unread?company=${cid}`, sessao);
    if (r.ok) {
      const d = await r.json() as Record<string, unknown>;
      boletinsNaoLidos = typeof d.total_bulletin_unread === "number" ? d.total_bulletin_unread as number : null;
    }
  } catch { /* ignora */ }

  try {
    const r = await getJson(`${BASE}/notification/count_message_not_read?companyId=${cid}`, sessao);
    if (r.ok) {
      const d = await r.json() as Record<string, unknown>;
      notificacoesNaoLidas = typeof d.monitorar === "number" ? d.monitorar as number : null;
    }
  } catch { /* ignora */ }

  return { totalAbertas, totalFavoritas, boletinsNaoLidos, notificacoesNaoLidas, capturadoEm: new Date() };
}

export async function buscarEventosCalendarioBeta(
  sessao: SessaoBeta,
  inicio: string,
  fim: string,
): Promise<LicitacaoExterna[]> {
  const r = await getJson(
    `${BASE}/gerenciar_licitacoes/calendario.json?start=${inicio}&end=${fim}&companyId=${sessao.companyId}`,
    sessao,
  );
  if (!r.ok) return [];
  const data = await r.json() as Record<string, unknown>;
  const events: unknown[] = Array.isArray(data.events) ? data.events : [];
  return events.map((e) => normalizarBetaEvento(e as Record<string, unknown>));
}

function normalizarBetaEvento(e: Record<string, unknown>): LicitacaoExterna {
  return {
    fonte: "beta",
    idExterno: String(e.id ?? e.pregao_id ?? ""),
    objeto: String(e.title ?? e.objeto ?? e.description ?? ""),
    orgao: String(e.orgao ?? e.entity ?? ""),
    uf: (String(e.uf ?? "").slice(0, 2)) || null,
    valorCentavos: e.valor ? Math.round(Number(e.valor) * 100) : null,
    dataAbertura: e.start ? new Date(String(e.start)) : null,
    dataEncerramento: e.end ? new Date(String(e.end)) : null,
    statusExt: "agendada",
    linkExterno: null,
    cnaes: [],
    bruto: e as Record<string, unknown>,
  };
}
