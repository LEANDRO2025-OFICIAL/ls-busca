// Etapas do funil: mesmos valores do check constraint de acompanhamento.etapa (schema.sql).
// Módulo neutro (sem "use client") para servir ao banco, às páginas e aos componentes.

export const ETAPAS = [
  "interesse",
  "analise",
  "decidido_participar",
  "proposta_enviada",
  "sessao_hoje",
  "em_disputa",
  "ganhou",
  "perdeu",
  "desistiu",
] as const;

export type EtapaId = (typeof ETAPAS)[number];

export const NOME_ETAPA: Record<EtapaId, string> = {
  interesse: "Triagem",
  analise: "Em análise",
  decidido_participar: "Decidido",
  proposta_enviada: "Proposta enviada",
  sessao_hoje: "Sessão hoje",
  em_disputa: "Em disputa",
  ganhou: "Ganhou",
  perdeu: "Perdeu",
  desistiu: "Desistiu",
};

export function ehEtapa(valor: string): valor is EtapaId {
  return (ETAPAS as readonly string[]).includes(valor);
}
