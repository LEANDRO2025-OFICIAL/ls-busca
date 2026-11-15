// Definição dos planos modulares e das funcionalidades por plano.
// Lógica pura e testável; sem chamadas ao banco aqui.

export const PLANOS_DISPONIVEIS = ["basico", "profissional", "empresarial", "premium", "completo"] as const;
export type Plano = (typeof PLANOS_DISPONIVEIS)[number];

export type Funcionalidade =
  | "busca"
  | "alertas"
  | "para_voce"
  | "funil"
  | "prazos"
  | "calendario"
  | "robo_simulado"
  | "robo_real"
  | "contratos"
  | "declaracoes"
  | "documentos"
  | "juridico";

export type InfoPlano = {
  nome: string;
  descricao: string;
  ordem: number;
  funcionalidades: Funcionalidade[];
};

const _BASE: Funcionalidade[] = ["busca", "alertas", "para_voce", "calendario"];
const _PROF: Funcionalidade[] = [..._BASE, "funil", "prazos", "robo_simulado", "documentos"];
const _EMP: Funcionalidade[] = [..._PROF, "robo_real"];
const _PREM: Funcionalidade[] = [..._EMP, "contratos", "declaracoes"];
const _COMP: Funcionalidade[] = [..._PREM, "juridico"];

export const INFO_PLANO: Record<Plano, InfoPlano> = {
  basico:       { nome: "Básico",       descricao: "Busca e alertas de licitações",             ordem: 1, funcionalidades: _BASE },
  profissional: { nome: "Profissional", descricao: "Funil, prazos e robô de simulação",          ordem: 2, funcionalidades: _PROF },
  empresarial:  { nome: "Empresarial",  descricao: "Robô de lance real e monitoramento",         ordem: 3, funcionalidades: _EMP  },
  premium:      { nome: "Premium",      descricao: "Contratos, ATAs e declarações",              ordem: 4, funcionalidades: _PREM },
  completo:     { nome: "Completo",     descricao: "Módulo jurídico — recursos e impugnações",   ordem: 5, funcionalidades: _COMP },
};

const _SETS: Record<Plano, Set<Funcionalidade>> = {
  basico:       new Set(_BASE),
  profissional: new Set(_PROF),
  empresarial:  new Set(_EMP),
  premium:      new Set(_PREM),
  completo:     new Set(_COMP),
};

export function planoTemFuncionalidade(plano: Plano | null | undefined, funcionalidade: Funcionalidade): boolean {
  if (!plano) return false;
  return _SETS[plano]?.has(funcionalidade) ?? false;
}

/** Retorna o plano mínimo que inclui a funcionalidade. */
export function planoMinimo(funcionalidade: Funcionalidade): Plano {
  for (const p of PLANOS_DISPONIVEIS) {
    if (_SETS[p].has(funcionalidade)) return p;
  }
  return "completo";
}

export function ehPlano(valor: unknown): valor is Plano {
  return typeof valor === "string" && (PLANOS_DISPONIVEIS as readonly string[]).includes(valor);
}
