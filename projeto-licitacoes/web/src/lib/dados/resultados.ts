// Coletor de resultados (contratações homologadas) do PNCP.
// Idempotente: usa upsert por numero_controle. Pode rodar duas vezes sem duplicar.
import { sql } from "drizzle-orm";
import type { Db } from "./db";

const BASE = "https://pncp.gov.br/api/consulta/v1";
const BASE_PNCP = "https://pncp.gov.br/api/pncp/v1";
const USER_AGENT = "licitacoes-app/0.1 (ingestao de dados publicos do PNCP)";
const PAUSA_MS = 2_500;

type ResultadoPncp = {
  numeroControlePNCP: string;
  anoCompra: number;
  sequencialCompra: number;
  objetoCompra: string;
  modalidadeNome: string;
  valorTotalEstimado?: number | null;
  valorTotalHomologado?: number | null;
  dataResultadoCompra?: string | null;
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao: { ufSigla: string; municipioNome?: string | null };
};

type ItemVencedor = {
  numeroItem?: number | null;
  descricao?: string | null;
  niFornecedor?: string | null;
  nomeRazaoSocialFornecedor?: string | null;
  valorUnitarioHomologado?: number | null;
  quantidade?: number | null;
  marcaFabricante?: string | null;
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPncpResultados(url: URL): Promise<Response> {
  const proxyEnv = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (!proxyEnv) {
    return fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  }
  const { request: httpRequest } = await import("node:http");
  const { request: httpsRequest } = await import("node:https");
  const { readFileSync } = await import("node:fs");
  const proxy = new URL(proxyEnv);
  return new Promise((resolve, reject) => {
    const proxyReq = httpRequest(
      { host: proxy.hostname, port: Number(proxy.port), method: "CONNECT", path: `${url.hostname}:443`, headers: { Host: `${url.hostname}:443` } },
      () => {},
    );
    const timer = setTimeout(() => { proxyReq.destroy(); reject(new Error("timeout")); }, 30_000);
    proxyReq.on("connect", (_r, socket) => {
      let ca: Buffer | undefined;
      try { ca = readFileSync("/root/.ccr/ca-bundle.crt"); } catch {}
      const req = httpsRequest(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { host: url.hostname, path: url.pathname + url.search, method: "GET", socket, agent: false, headers: { Accept: "application/json", "User-Agent": USER_AGENT, Host: url.hostname }, ...(ca ? { ca } : {}) } as any,
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (d: Buffer) => chunks.push(d));
          res.on("end", () => { clearTimeout(timer); resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 200 })); });
          res.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
        },
      );
      req.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
      req.end();
    });
    proxyReq.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
    proxyReq.end();
  });
}

async function buscarPagina(params: { dataInicial: string; dataFinal: string; pagina: number }): Promise<{ data: ResultadoPncp[]; totalPaginas: number }> {
  const url = new URL(`${BASE}/contratacoes/resultado`);
  url.searchParams.set("dataInicial", params.dataInicial);
  url.searchParams.set("dataFinal", params.dataFinal);
  url.searchParams.set("pagina", String(params.pagina));
  url.searchParams.set("tamanhoPagina", "100");

  for (let tentativa = 0; ; tentativa++) {
    let res: Response;
    try {
      res = await fetchPncpResultados(url);
    } catch (e) {
      if (tentativa < 3) { await esperar(2 ** tentativa * 3_000); continue; }
      throw e;
    }
    if (res.status === 204) return { data: [], totalPaginas: 0 };
    if (res.ok) {
      const json = await res.json() as { data?: ResultadoPncp[]; totalPaginas?: number };
      return { data: json.data ?? [], totalPaginas: json.totalPaginas ?? 0 };
    }
    if ((res.status === 429 || res.status >= 500) && tentativa < 4) {
      await esperar(res.status === 429 ? 20_000 * (tentativa + 1) : 2 ** tentativa * 2_000);
      continue;
    }
    throw new Error(`PNCP resultados respondeu HTTP ${res.status}`);
  }
}

async function buscarItens(cnpj: string, ano: number, sequencial: number): Promise<ItemVencedor[]> {
  const url = new URL(`${BASE_PNCP}/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens/resultado`);
  for (let tentativa = 0; ; tentativa++) {
    let res: Response;
    try {
      res = await fetchPncpResultados(url);
    } catch (e) {
      if (tentativa < 2) { await esperar(2 ** tentativa * 2_000); continue; }
      return [];
    }
    if (res.status === 204 || res.status === 404) return [];
    if (res.ok) return (await res.json() as ItemVencedor[]) ?? [];
    if (res.status >= 500 && tentativa < 2) { await esperar(2_000); continue; }
    return [];
  }
}

function yyyyMMdd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function toCentavos(valor: number | null | undefined): bigint | null {
  if (valor == null) return null;
  return BigInt(Math.round(valor * 100));
}

function calcularDesconto(estimado: number | null | undefined, homologado: number | null | undefined): number | null {
  if (!estimado || !homologado || estimado <= 0) return null;
  return Math.round(((estimado - homologado) / estimado) * 10_000);
}

/** Captura os resultados (contratações homologadas) de uma janela de datas. Idempotente. */
export async function capturarResultados(
  db: Db,
  janela: { dataInicial: string; dataFinal: string },
): Promise<{ gravados: number; erros: string[] }> {
  const erros: string[] = [];
  let gravados = 0;
  let pagina = 1;

  for (;;) {
    const { data, totalPaginas } = await buscarPagina({ ...janela, pagina });
    if (data.length === 0) break;

    for (const r of data) {
      try {
        const itens = await buscarItens(r.orgaoEntidade.cnpj, r.anoCompra, r.sequencialCompra);
        await esperar(500);

        const estimado = toCentavos(r.valorTotalEstimado);
        const homologado = toCentavos(r.valorTotalHomologado);
        const desconto = calcularDesconto(r.valorTotalEstimado, r.valorTotalHomologado);
        const dataResultado = r.dataResultadoCompra ? new Date(r.dataResultadoCompra) : null;

        await db.execute(sql`
          insert into resultado_licitacao
            (numero_controle, orgao_cnpj, uf, municipio, modalidade, objeto,
             valor_estimado_centavos, valor_homologado_centavos, desconto_centesimos,
             data_resultado, itens)
          values
            (${r.numeroControlePNCP}, ${r.orgaoEntidade.cnpj},
             ${r.unidadeOrgao.ufSigla}, ${r.unidadeOrgao.municipioNome ?? null},
             ${r.modalidadeNome}, ${r.objetoCompra},
             ${estimado}, ${homologado}, ${desconto},
             ${dataResultado}, ${JSON.stringify(itens)}::jsonb)
          on conflict (numero_controle) do update set
            valor_homologado_centavos = excluded.valor_homologado_centavos,
            desconto_centesimos       = excluded.desconto_centesimos,
            data_resultado            = excluded.data_resultado,
            itens                     = excluded.itens,
            capturado_em              = now()
        `);

        if (itens.length > 0) {
          await db.execute(sql`
            delete from resultado_item_vencedor where numero_controle = ${r.numeroControlePNCP}
          `);
          for (const item of itens) {
            await db.execute(sql`
              insert into resultado_item_vencedor
                (numero_controle, numero_item, descricao, ni_fornecedor, nome_fornecedor,
                 valor_unitario_centavos, quantidade, marca)
              values
                (${r.numeroControlePNCP}, ${item.numeroItem ?? null}, ${item.descricao ?? null},
                 ${item.niFornecedor ?? null}, ${item.nomeRazaoSocialFornecedor ?? null},
                 ${toCentavos(item.valorUnitarioHomologado)}, ${item.quantidade ?? null},
                 ${item.marcaFabricante ?? null})
            `);
          }
        }
        gravados++;
      } catch (e) {
        erros.push(`${r.numeroControlePNCP}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (pagina >= totalPaginas) break;
    pagina++;
    await esperar(PAUSA_MS);
  }

  return { gravados, erros };
}

/** Janela de N dias a partir de hoje (formato yyyyMMdd). */
export function janelaRetroativa(dias: number): { dataInicial: string; dataFinal: string } {
  const fim = new Date();
  const ini = new Date(fim.getTime() - dias * 86_400_000);
  return { dataInicial: yyyyMMdd(ini), dataFinal: yyyyMMdd(fim) };
}
