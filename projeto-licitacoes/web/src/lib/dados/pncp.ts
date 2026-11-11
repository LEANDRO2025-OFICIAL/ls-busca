// Cliente da API pública de Consultas do PNCP (sem autenticação).
// Documentação: https://pncp.gov.br/api/consulta/v3/api-docs
import { cacheLife } from "next/cache";

const BASE = "https://pncp.gov.br/api/consulta/v1";
const USER_AGENT = "licitacoes-app/0.1 (ingestao de dados publicos do PNCP)";

export type CompraPncp = {
  numeroControlePNCP: string;
  anoCompra: number;
  sequencialCompra: number;
  numeroCompra?: string | null;
  processo?: string | null;
  objetoCompra: string;
  informacaoComplementar?: string | null;
  modalidadeId: number;
  modalidadeNome: string;
  modoDisputaId?: number | null;
  modoDisputaNome?: string | null;
  situacaoCompraId: string | number;
  situacaoCompraNome: string;
  srp?: boolean | null;
  valorTotalEstimado?: number | null;
  dataAberturaProposta?: string | null;
  dataEncerramentoProposta?: string | null;
  dataPublicacaoPncp?: string | null;
  dataAtualizacaoGlobal?: string | null;
  linkSistemaOrigem?: string | null;
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao: { ufSigla: string; municipioNome?: string | null; codigoIbge?: string | null; nomeUnidade?: string | null };
};

export type PaginaPncp = {
  data: CompraPncp[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
};

const PAGINA_VAZIA: PaginaPncp = { data: [], totalRegistros: 0, totalPaginas: 0, numeroPagina: 0 };

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/** Contratações com recebimento de propostas em aberto. */
export async function buscarPropostasAbertas(parametros: {
  dataFinal: string; // yyyyMMdd
  modalidade: number;
  uf?: string;
  pagina: number;
  tamanhoPagina?: number;
}): Promise<PaginaPncp> {
  const url = new URL(`${BASE}/contratacoes/proposta`);
  url.searchParams.set("dataFinal", parametros.dataFinal);
  url.searchParams.set("codigoModalidadeContratacao", String(parametros.modalidade));
  if (parametros.uf) url.searchParams.set("uf", parametros.uf);
  url.searchParams.set("pagina", String(parametros.pagina));
  url.searchParams.set("tamanhoPagina", String(parametros.tamanhoPagina ?? 50));

  for (let tentativa = 0; ; tentativa++) {
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (erro) {
      // Timeout ou queda de rede: trata como instabilidade e tenta de novo.
      if (tentativa < 3) {
        await esperar(2 ** tentativa * 3_000);
        continue;
      }
      throw erro;
    }
    if (resposta.status === 204) return PAGINA_VAZIA;
    if (resposta.ok) return (await resposta.json()) as PaginaPncp;
    // 429: limite de taxa do PNCP (medido em 2026-10: dispara perto de 1 req/s, sem
    // Retry-After, e libera em menos de 15 s). 5xx: instabilidade. Espera e tenta de novo.
    if (resposta.status === 429 && tentativa < 4) {
      await esperar(20_000 * (tentativa + 1));
      continue;
    }
    if (resposta.status >= 500 && tentativa < 3) {
      await esperar(2 ** tentativa * 2_000);
      continue;
    }
    throw new Error(`PNCP respondeu HTTP ${resposta.status} em ${url.pathname}`);
  }
}

export type ArquivoPncp = { titulo: string; tipo: string; url: string; publicadoEmISO: string | null };

/**
 * Edital e anexos que o órgão publicou no PNCP (API principal, sem autenticação).
 * Cache de horas: arquivo novo é raro e cada visita ao detalhe não deve gastar o limite de taxa.
 * Falha lança erro (e não entra no cache), para a tela mostrar o aviso e tentar de novo depois.
 */
export async function listarArquivos(cnpj: string, ano: number, sequencial: number): Promise<ArquivoPncp[]> {
  "use cache";
  cacheLife("hours");
  const resposta = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (resposta.status === 204 || resposta.status === 404) return [];
  if (!resposta.ok) throw new Error(`PNCP respondeu HTTP ${resposta.status} ao listar arquivos`);
  const lista = (await resposta.json()) as {
    url?: string;
    titulo?: string | null;
    tipoDocumentoNome?: string | null;
    statusAtivo?: boolean;
    dataPublicacaoPncp?: string | null;
  }[];
  return (
    lista
      // O link vai direto para um href: só aceitamos endereço https do próprio PNCP.
      .filter((a) => a.statusAtivo !== false && typeof a.url === "string" && a.url.startsWith("https://pncp.gov.br/"))
      .map((a) => ({
        titulo: a.titulo?.trim() || a.tipoDocumentoNome || "Documento",
        tipo: a.tipoDocumentoNome ?? "Documento",
        url: a.url as string,
        publicadoEmISO: dataBrasilia(a.dataPublicacaoPncp)?.toISOString() ?? null,
      }))
  );
}

/**
 * O PNCP manda datas sem fuso ("2026-10-23T08:59:00"). Tratamos como horário de
 * Brasília (UTC−3, sem horário de verão desde 2019). Ver risco de fuso em architecture.md.
 */
export function dataBrasilia(valor?: string | null): Date | null {
  if (!valor) return null;
  const data = new Date(`${valor.slice(0, 19)}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function paraLinhaLicitacao(c: CompraPncp) {
  return {
    numeroControlePncp: c.numeroControlePNCP,
    cnpjOrgao: c.orgaoEntidade.cnpj,
    ano: c.anoCompra,
    sequencial: c.sequencialCompra,
    numeroCompra: c.numeroCompra ?? null,
    processo: c.processo ?? null,
    objeto: c.objetoCompra.trim(),
    informacaoComplementar: c.informacaoComplementar ?? null,
    modalidadeId: c.modalidadeId,
    modoDisputaId: c.modoDisputaId ?? null,
    modoDisputaNome: c.modoDisputaNome ?? null,
    situacaoId: Number(c.situacaoCompraId),
    situacaoNome: c.situacaoCompraNome,
    srp: Boolean(c.srp),
    valorEstimadoCentavos: c.valorTotalEstimado == null ? null : Math.round(c.valorTotalEstimado * 100),
    dataAbertura: dataBrasilia(c.dataAberturaProposta),
    dataEncerramento: dataBrasilia(c.dataEncerramentoProposta),
    dataPublicacao: dataBrasilia(c.dataPublicacaoPncp),
    dataAtualizacaoPncp: dataBrasilia(c.dataAtualizacaoGlobal),
    uf: c.unidadeOrgao.ufSigla,
    municipio: c.unidadeOrgao.municipioNome ?? null,
    codigoIbge: c.unidadeOrgao.codigoIbge ?? null,
    orgaoNome: c.orgaoEntidade.razaoSocial,
    unidadeNome: c.unidadeOrgao.nomeUnidade ?? null,
    linkOrigem: c.linkSistemaOrigem ?? null,
    bruto: c,
  };
}
