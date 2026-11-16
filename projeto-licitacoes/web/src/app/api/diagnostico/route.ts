/**
 * Diagnóstico de conectividade com o PNCP — útil para depurar falhas na Railway.
 * Em produção exige o mesmo segredo do cron para evitar exposição.
 * Leitura do header torna a rota dinâmica (nunca pré-renderizada no build).
 */
export async function GET(request: Request) {
  const autorizacao = request.headers.get("authorization");
  const segredo = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && (!segredo || autorizacao !== `Bearer ${segredo}`)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }

  const hoje = new Date();
  const dataInicial = formatarData(hoje);
  const dataFinal = formatarData(new Date(hoje.getTime() + 120 * 86_400_000));

  const url = new URL("https://pncp.gov.br/api/consulta/v1/contratacoes/proposta");
  url.searchParams.set("dataInicial", dataInicial);
  url.searchParams.set("dataFinal", dataFinal);
  url.searchParams.set("codigoModalidadeContratacao", "6");
  url.searchParams.set("pagina", "1");
  url.searchParams.set("tamanhoPagina", "10");

  const inicio = Date.now();
  try {
    const resposta = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "licitacoes-app/0.1 (ingestao de dados publicos do PNCP)" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const tempoMs = Date.now() - inicio;
    if (resposta.ok) {
      const json = (await resposta.json()) as { totalRegistros?: number; totalPaginas?: number; data?: unknown[] };
      return Response.json({ ok: true, status: resposta.status, tempoMs, totalRegistros: json.totalRegistros, totalPaginas: json.totalPaginas, amostras: json.data?.length });
    }
    const corpo = await resposta.text().catch(() => "(sem corpo)");
    return Response.json({ ok: false, status: resposta.status, tempoMs, corpo: corpo.slice(0, 500) });
  } catch (erro) {
    const tempoMs = Date.now() - inicio;
    return Response.json({ ok: false, tempoMs, erro: String(erro) }, { status: 502 });
  }
}

function formatarData(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d).replace(/-/g, "");
}
