// Decisão de acesso por organização (lógica pura, testável): a partir do estado da licença e das
// datas, diz se as telas de trabalho estão liberadas e, quando não, por quê. A verificação de
// verdade roda no servidor (src/lib/sessao.ts e os route handlers), nunca só no navegador.

export const ESTADOS_LICENCA = ["avaliacao", "ativa", "expirada", "bloqueada"] as const;
export type EstadoLicenca = (typeof ESTADOS_LICENCA)[number];

export function ehEstadoLicenca(valor: unknown): valor is EstadoLicenca {
  return typeof valor === "string" && (ESTADOS_LICENCA as readonly string[]).includes(valor);
}

export type DadosLicenca = {
  estado: EstadoLicenca;
  trialFim: Date | null;
  licencaExpiraEm: Date | null;
};

export type Situacao = {
  /** Se as telas e rotas de trabalho estão liberadas. */
  liberado: boolean;
  estado: EstadoLicenca;
  /** "avaliacao" (teste vigente), "ativa" (licença válida), ou um motivo de bloqueio. */
  situacao: "avaliacao" | "ativa" | "trial_encerrado" | "expirada" | "bloqueada";
  /** Mensagem pronta para o usuário quando bloqueado (null quando liberado). */
  motivo: string | null;
  /** Milissegundos restantes do teste quando em avaliação liberada (para o banner). */
  trialRestanteMs: number | null;
  /** Milissegundos restantes da licença ativa com validade (null = sem data de expiração). */
  licencaRestanteMs: number | null;
};

const MSG_TRIAL = "Período de avaliação encerrado — fale com o fornecedor para assinar.";
const MSG_EXPIRADA = "A licença desta conta expirou. Fale com o fornecedor para renovar.";
const MSG_BLOQUEADA = "Acesso suspenso pelo fornecedor. Entre em contato para regularizar.";

/**
 * Nunca libera sozinho um teste vencido nem estende prazo: só devolve o que o estado e as datas
 * dizem. Quem muda estado é o nível máximo (dono do sistema), em outra tela.
 */
export function avaliarLicenca(d: DadosLicenca, agora: Date = new Date()): Situacao {
  const base = { estado: d.estado, trialRestanteMs: null, licencaRestanteMs: null };

  if (d.estado === "bloqueada") {
    return { ...base, liberado: false, situacao: "bloqueada", motivo: MSG_BLOQUEADA };
  }
  if (d.estado === "expirada") {
    return { ...base, liberado: false, situacao: "expirada", motivo: MSG_EXPIRADA };
  }
  if (d.estado === "ativa") {
    if (d.licencaExpiraEm && d.licencaExpiraEm.getTime() <= agora.getTime()) {
      // Licença ativa com validade vencida conta como expirada (sem precisar de mudança manual).
      return { ...base, liberado: false, situacao: "expirada", motivo: MSG_EXPIRADA };
    }
    return {
      ...base,
      liberado: true,
      situacao: "ativa",
      motivo: null,
      licencaRestanteMs: d.licencaExpiraEm ? d.licencaExpiraEm.getTime() - agora.getTime() : null,
    };
  }
  // avaliacao
  if (d.trialFim && d.trialFim.getTime() > agora.getTime()) {
    return {
      ...base,
      liberado: true,
      situacao: "avaliacao",
      motivo: null,
      trialRestanteMs: d.trialFim.getTime() - agora.getTime(),
    };
  }
  return { ...base, liberado: false, situacao: "trial_encerrado", motivo: MSG_TRIAL };
}

/** Texto curto do tempo restante (ex.: "2 dias e 3 horas", "5 horas", "12 minutos"). */
export function tempoRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000)); // minutos
  const dias = Math.floor(total / 1440);
  const horas = Math.floor((total % 1440) / 60);
  const minutos = total % 60;
  const parte = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  if (dias > 0) return horas > 0 ? `${parte(dias, "dia", "dias")} e ${parte(horas, "hora", "horas")}` : parte(dias, "dia", "dias");
  if (horas > 0) return minutos > 0 ? `${parte(horas, "hora", "horas")} e ${parte(minutos, "minuto", "minutos")}` : parte(horas, "hora", "horas");
  return parte(minutos, "minuto", "minutos");
}
