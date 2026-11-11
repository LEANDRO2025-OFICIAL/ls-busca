// Etapas do funil: mesmos valores do check constraint de acompanhamento.etapa (migração 0005).
// Módulo neutro (sem "use client" e sem imports) para servir ao banco, às páginas, aos
// componentes e aos testes (node --test importa este arquivo direto).

export const ETAPAS = [
  "interesse",
  "analise",
  "decidido_participar",
  "proposta_enviada",
  "sessao_hoje",
  "em_disputa",
  "ganhou",
  "homologacao",
  "contrato",
  "perdeu",
  "desistiu",
] as const;

export type EtapaId = (typeof ETAPAS)[number];

export const NOME_ETAPA: Record<EtapaId, string> = {
  interesse: "Triagem",
  analise: "Em análise",
  decidido_participar: "Decidido participar",
  proposta_enviada: "Proposta enviada",
  sessao_hoje: "Sessão hoje",
  em_disputa: "Em disputa",
  ganhou: "Ganhou",
  homologacao: "Homologada",
  contrato: "Contrato assinado",
  perdeu: "Perdeu",
  desistiu: "Desistiu",
};

export function ehEtapa(valor: string): valor is EtapaId {
  return (ETAPAS as readonly string[]).includes(valor);
}

/** Etapas que tiram a licitação do fluxo (não pertencem a nenhuma fase). */
export const ETAPAS_ENCERRADAS = ["perdeu", "desistiu"] as const satisfies readonly EtapaId[];

/** As 6 fases do funil, em ordem. A primeira etapa de cada fase é a entrada padrão da fase. */
export const FASES = [
  { id: "descoberta", nome: "Descoberta", etapas: ["interesse"] },
  { id: "analise", nome: "Análise", etapas: ["analise"] },
  { id: "interesse", nome: "Interesse", etapas: ["decidido_participar"] },
  { id: "proposta", nome: "Proposta", etapas: ["proposta_enviada", "sessao_hoje", "em_disputa"] },
  { id: "homologacao", nome: "Homologação", etapas: ["ganhou", "homologacao"] },
  { id: "contrato", nome: "Contrato", etapas: ["contrato"] },
] as const satisfies readonly { id: string; nome: string; etapas: readonly EtapaId[] }[];

export type FaseId = (typeof FASES)[number]["id"];

/** Índice da fase (0 a 5) da etapa, ou -1 para perdeu/desistiu. */
export function indiceDaFase(etapa: string): number {
  return FASES.findIndex((f) => (f.etapas as readonly string[]).includes(etapa));
}

export function faseDaEtapa(etapa: string): FaseId | null {
  return FASES[indiceDaFase(etapa)]?.id ?? null;
}

export type CartaoParaResumo = {
  etapa: string;
  valorCentavos: number | null;
  /** Etapas por onde o cartão já passou (mudanca_etapa.para). Serve a quem saiu do fluxo. */
  historico?: readonly string[];
};

export type ResumoFase = {
  id: FaseId;
  nome: string;
  /** Cartões que estão na fase agora. */
  quantidade: number;
  /** Soma do valor estimado dos cartões que estão na fase agora (sem valor conta zero). */
  valorCentavos: number;
  /** Cartões que chegaram a esta fase ou passaram dela (inclui os que depois perderam ou desistiram). */
  alcancaram: number;
  /** Dos que alcançaram esta fase, a fração (0 a 1) que alcançou a seguinte. null: sem base ou última fase. */
  conversao: number | null;
};

/**
 * Agrupa os cartões nas 6 fases com contagem, valor e taxa de conversão para a fase seguinte.
 * Quem pulou uma fase conta como tendo passado por ela (chegar ao contrato implica ter proposto).
 */
export function resumirFases(cartoes: readonly CartaoParaResumo[]): { fases: ResumoFase[]; encerradas: number; total: number } {
  const quantidade = FASES.map(() => 0);
  const valor = FASES.map(() => 0);
  const alcancaram = FASES.map(() => 0);
  let encerradas = 0;

  for (const c of cartoes) {
    const atual = indiceDaFase(c.etapa);
    if (atual >= 0) {
      quantidade[atual]++;
      valor[atual] += c.valorCentavos ?? 0;
    } else {
      encerradas++;
    }
    // Todo cartão entrou pela Descoberta, mesmo sem histórico.
    const maior = Math.max(0, atual, ...(c.historico ?? []).map(indiceDaFase));
    for (let i = 0; i <= maior; i++) alcancaram[i]++;
  }

  const fases = FASES.map((f, i) => ({
    id: f.id,
    nome: f.nome,
    quantidade: quantidade[i],
    valorCentavos: valor[i],
    alcancaram: alcancaram[i],
    conversao: i === FASES.length - 1 || alcancaram[i] === 0 ? null : alcancaram[i + 1] / alcancaram[i],
  }));
  return { fases, encerradas, total: cartoes.length };
}
