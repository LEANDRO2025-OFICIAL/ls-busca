// Casamento alerta × licitação: lógica pura (sem banco e sem imports), usada pela ingestão para
// gerar avisos e coberta por testes (node --test importa este arquivo direto).

export type Criterio = {
  /** Todos precisam aparecer no texto da licitação. */
  termos: string[];
  /** Nenhum pode aparecer. */
  excluidos: string[];
  /** Se preenchido, pelo menos um precisa aparecer (termos do ramo da empresa). */
  algumDe?: string[];
  uf: string | null;
  municipio: string | null;
  modalidade: number | null;
  valorMinCentavos: number | null;
  valorMaxCentavos: number | null;
};

export type LicitacaoParaCasar = {
  objeto: string;
  orgao: string;
  complemento?: string | null;
  uf: string;
  municipio: string | null;
  modalidadeId: number;
  valorCentavos: number | null;
};

/** Minúsculas, sem acento, só letras e números separados por um espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lê o texto da busca (cimento -asfalto "material de construção") em termos e termos excluídos. */
export function lerTermos(q: string): { termos: string[]; excluidos: string[] } {
  const termos = new Set<string>();
  const excluidos = new Set<string>();
  for (const m of q.matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)) {
    const negado = (m[1] ?? m[3]) === "-";
    const termo = normalizar(m[2] ?? m[4] ?? "");
    // "or" é operador da busca na tela; no alerta cada palavra é obrigatória.
    if (!termo || termo === "or") continue;
    (negado ? excluidos : termos).add(termo);
  }
  return { termos: [...termos], excluidos: [...excluidos] };
}

/**
 * O termo (já normalizado) aparece no texto (já normalizado, com espaços nas pontas)?
 * Casa no começo de palavra, então "cimento" pega "cimentos" e não pega "fornecimento".
 */
function contem(texto: string, termo: string): boolean {
  return texto.includes(` ${termo}`);
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Diz se a licitação casa com o critério e, se casa, o motivo em uma frase curta. */
export function casar(c: Criterio, l: LicitacaoParaCasar): { casa: false } | { casa: true; motivo: string } {
  if (c.uf && c.uf.toUpperCase() !== l.uf.toUpperCase()) return { casa: false };
  if (c.municipio && normalizar(c.municipio) !== normalizar(l.municipio ?? "")) return { casa: false };
  if (c.modalidade != null && c.modalidade !== l.modalidadeId) return { casa: false };
  // Sem valor estimado, não dá para afirmar que está na faixa.
  if (c.valorMinCentavos != null && (l.valorCentavos == null || l.valorCentavos < c.valorMinCentavos)) return { casa: false };
  if (c.valorMaxCentavos != null && (l.valorCentavos == null || l.valorCentavos > c.valorMaxCentavos)) return { casa: false };

  const texto = ` ${normalizar(`${l.objeto} ${l.orgao} ${l.complemento ?? ""}`)} `;
  if (c.excluidos.some((t) => contem(texto, normalizar(t)))) return { casa: false };
  if (!c.termos.every((t) => contem(texto, normalizar(t)))) return { casa: false };
  const doRamo = (c.algumDe ?? []).filter((t) => contem(texto, normalizar(t)));
  if (c.algumDe?.length && doRamo.length === 0) return { casa: false };

  const motivo = [
    ...[...c.termos, ...doRamo].slice(0, 4).map((t) => `contém “${t}”`),
    c.uf && `UF ${c.uf.toUpperCase()}`,
    c.municipio && `município ${l.municipio}`,
    c.modalidade != null && "modalidade escolhida",
    c.valorMinCentavos != null && `valor a partir de ${reais.format(c.valorMinCentavos / 100)}`,
    c.valorMaxCentavos != null && `valor até ${reais.format(c.valorMaxCentavos / 100)}`,
  ].filter(Boolean);
  return { casa: true, motivo: motivo.length ? motivo.join("; ") : "licitação nova" };
}

/** Valor mínimo padrão do mural de grandes licitações: R$ 10 milhões. */
export const LIMITE_COMUNIDADE_PADRAO_REAIS = 10_000_000;

/** Lê COMUNIDADE_VALOR_MINIMO (em reais, só dígitos contam). Devolve centavos. */
export function lerLimiteComunidade(valor: string | undefined): number {
  const n = Number.parseInt((valor ?? "").replace(/\D/g, ""), 10);
  return (Number.isFinite(n) && n > 0 ? n : LIMITE_COMUNIDADE_PADRAO_REAIS) * 100;
}

export type AvisoParaWebhook = {
  id: string;
  criadoEm: Date;
  motivo: string;
  alerta: { id: string; nome: string; tipo: string };
  licitacao: {
    numeroControle: string;
    objeto: string;
    orgao: string;
    uf: string;
    municipio: string | null;
    modalidade: string;
    valorCentavos: number | null;
    encerramento: Date | null;
    cnpj: string;
    ano: number;
    sequencial: number;
  };
  /** Melhoria 8: campos opcionais de enriquecimento. */
  enriquecimento?: {
    aderencia?: { nota: number; principaisMotivos: string[] } | null;
    referencia?: { descontoMediano: number | null; amostra: number } | null;
  };
};

/** Corpo JSON enviado a ALERTA_WEBHOOK_URL (formato documentado no README). */
export function montarCorpoWebhook(avisos: AvisoParaWebhook[], agora: Date) {
  return {
    evento: "avisos.novos" as const,
    enviadoEm: agora.toISOString(),
    avisos: avisos.map((a) => ({
      id: a.id,
      criadoEm: a.criadoEm.toISOString(),
      motivo: a.motivo,
      alerta: a.alerta,
      licitacao: {
        numeroControle: a.licitacao.numeroControle,
        objeto: a.licitacao.objeto,
        orgao: a.licitacao.orgao,
        uf: a.licitacao.uf,
        municipio: a.licitacao.municipio,
        modalidade: a.licitacao.modalidade,
        valorEstimado: a.licitacao.valorCentavos == null ? null : a.licitacao.valorCentavos / 100,
        encerramento: a.licitacao.encerramento?.toISOString() ?? null,
        caminho: `/licitacao/${a.licitacao.cnpj}/${a.licitacao.ano}/${a.licitacao.sequencial}`,
      },
      // Enriquecimento optional (Melhoria 8): presente quando aderência e/ou preço de referência estão disponíveis.
      ...(a.enriquecimento ? { aderencia: a.enriquecimento.aderencia ?? undefined, referencia: a.enriquecimento.referencia ?? undefined } : {}),
    })),
  };
}
