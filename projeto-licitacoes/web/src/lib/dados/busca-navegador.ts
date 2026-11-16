// Busca ao vivo no PNCP diretamente do navegador (sem dependências Node.js).
// O PNCP tem Access-Control-Allow-Origin: * então chamadas browser funcionam de qualquer origem.
// Usado quando a base local está vazia (modo Railway sem ingestão).

const BASE_PNCP = "https://pncp.gov.br/api/consulta/v1";
const UA = "licitacoes-app/0.1 (ingestao de dados publicos do PNCP)";

export const POR_PAGINA_NAVEGADOR = 20;

type CompraPncp = {
  numeroControlePNCP: string;
  anoCompra: number;
  sequencialCompra: number;
  objetoCompra: string;
  modalidadeId: number;
  modalidadeNome: string;
  valorTotalEstimado?: number | null;
  dataEncerramentoProposta?: string | null;
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao: { ufSigla: string; municipioNome?: string | null };
};

export type LinhaAoVivo = {
  id: string;
  cnpj: string;
  ano: number;
  sequencial: number;
  objeto: string;
  orgao: string;
  municipio: string | null;
  uf: string;
  modalidade: string;
  valorCentavos: number | null;
  encerramento: Date | null;
};

function formatarData(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(d)
    .replace(/-/g, "");
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function parseBrasilia(valor?: string | null): Date | null {
  if (!valor) return null;
  const d = new Date(`${valor.slice(0, 19)}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function buscarPagina(
  dataInicial: string,
  dataFinal: string,
  modalidade: number,
  uf: string | undefined,
  pagina: number,
): Promise<CompraPncp[]> {
  const url = new URL(`${BASE_PNCP}/contratacoes/proposta`);
  url.searchParams.set("dataInicial", dataInicial);
  url.searchParams.set("dataFinal", dataFinal);
  url.searchParams.set("codigoModalidadeContratacao", String(modalidade));
  if (uf) url.searchParams.set("uf", uf);
  url.searchParams.set("pagina", String(pagina));
  url.searchParams.set("tamanhoPagina", "100");

  const r = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(25_000),
  });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`PNCP HTTP ${r.status}`);
  const json = (await r.json()) as { data: CompraPncp[] };
  return json.data ?? [];
}

export async function buscarAoVivoNoNavegador(params: {
  q: string;
  uf?: string | null;
  modalidade?: number | null;
  pagina: number;
}): Promise<{ total: number; parcial: boolean; linhas: LinhaAoVivo[]; erro?: string }> {
  const hoje = new Date();
  const dataInicial = formatarData(hoje);
  const dataFinal = formatarData(new Date(hoje.getTime() + 120 * 86_400_000));

  const TOP_MODALIDADES = [6, 12, 4, 8];
  const modalidades = params.modalidade ? [params.modalidade] : TOP_MODALIDADES;

  // 12 requisições em paralelo — o browser gerencia a fila (~6 por domínio).
  const tarefas = modalidades.flatMap((mod) =>
    [1, 2, 3].map((pg) => buscarPagina(dataInicial, dataFinal, mod, params.uf ?? undefined, pg)),
  );

  const resultados = await Promise.allSettled(tarefas);
  const falhas = resultados.filter((r) => r.status === "rejected");

  if (falhas.length === resultados.length) {
    const razao = (falhas[0] as PromiseRejectedResult).reason;
    return { total: 0, parcial: true, linhas: [], erro: String(razao) };
  }

  const todas = resultados
    .filter((r): r is PromiseFulfilledResult<CompraPncp[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const q = normalizar(params.q.trim());
  const filtradas = q
    ? todas.filter(
        (c) =>
          normalizar(c.objetoCompra).includes(q) ||
          normalizar(c.orgaoEntidade.razaoSocial).includes(q),
      )
    : todas;

  filtradas.sort((a, b) => {
    const da = new Date(a.dataEncerramentoProposta ?? "9999").getTime();
    const db = new Date(b.dataEncerramentoProposta ?? "9999").getTime();
    return da - db;
  });

  const inicio = (params.pagina - 1) * POR_PAGINA_NAVEGADOR;
  return {
    total: filtradas.length,
    parcial: falhas.length > 0,
    linhas: filtradas.slice(inicio, inicio + POR_PAGINA_NAVEGADOR).map((c) => ({
      id: c.numeroControlePNCP,
      cnpj: c.orgaoEntidade.cnpj,
      ano: c.anoCompra,
      sequencial: c.sequencialCompra,
      objeto: c.objetoCompra.trim(),
      orgao: c.orgaoEntidade.razaoSocial,
      municipio: c.unidadeOrgao.municipioNome ?? null,
      uf: c.unidadeOrgao.ufSigla,
      modalidade: c.modalidadeNome,
      valorCentavos: c.valorTotalEstimado == null ? null : Math.round(c.valorTotalEstimado * 100),
      encerramento: parseBrasilia(c.dataEncerramentoProposta),
    })),
  };
}
