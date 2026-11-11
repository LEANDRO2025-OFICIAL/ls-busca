import { UFS } from "@/lib/dados/perfil";

// Leitura dos filtros da busca a partir da URL. Serve à tela de busca e às buscas salvas
// (que guardam os mesmos parâmetros), então os dois lados validam do mesmo jeito.

export type ParametrosUrl = Record<string, string | string[] | undefined>;

/** Parâmetros que uma busca salva guarda (pagina e desde ficam de fora). */
export const CHAVES_SALVAS = ["q", "encerra", "ramo", "uf", "mun", "mod", "vmin", "vmax", "ader"] as const;

function primeiro(valor: string | string[] | undefined) {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export function lerFiltros(parametros: ParametrosUrl) {
  const q = primeiro(parametros.q).slice(0, 200);
  const encerra = primeiro(parametros.encerra) === "7" ? 7 : null;
  const ramo = primeiro(parametros.ramo) === "1";
  const ufParam = primeiro(parametros.uf).toUpperCase();
  const uf = (UFS as readonly string[]).includes(ufParam) ? ufParam : null;
  const municipio = primeiro(parametros.mun).trim().replace(/\s+/g, " ").slice(0, 80) || null;
  const modalidade = Number.parseInt(primeiro(parametros.mod), 10) || null;
  const reais = (v: string) => {
    const n = Number.parseInt(v.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };
  const valorMin = reais(primeiro(parametros.vmin));
  const valorMax = reais(primeiro(parametros.vmax));
  // Só os cortes das faixas "Média" (40) e "Alta" (70) de faixaAderencia.
  const aderenciaParam = Number.parseInt(primeiro(parametros.ader), 10);
  const aderencia = aderenciaParam === 40 || aderenciaParam === 70 ? aderenciaParam : null;
  const pagina = Math.min(500, Math.max(1, Number.parseInt(primeiro(parametros.pagina), 10) || 1));
  const desdeData = new Date(primeiro(parametros.desde));
  const desde = Number.isNaN(desdeData.getTime()) ? null : desdeData;

  const atuais: Record<string, string> = {
    q,
    encerra: encerra ? "7" : "",
    ramo: ramo ? "1" : "",
    uf: uf ?? "",
    mun: municipio ?? "",
    mod: modalidade ? String(modalidade) : "",
    vmin: valorMin == null ? "" : String(valorMin),
    vmax: valorMax == null ? "" : String(valorMax),
    ader: aderencia ? String(aderencia) : "",
    desde: desde ? desde.toISOString() : "",
  };
  return { q, encerra, ramo, uf, municipio, modalidade, valorMin, valorMax, aderencia, pagina, desde, atuais };
}

export function montarHref(atuais: Record<string, string>, mudanca: Record<string, string | null> = {}) {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries({ ...atuais, ...mudanca })) {
    if (valor) parametros.set(chave, valor);
  }
  const texto = parametros.toString();
  return texto ? `/buscar?${texto}` : "/buscar";
}
