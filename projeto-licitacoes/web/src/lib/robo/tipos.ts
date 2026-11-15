// Robô de lance: tipos compartilhados pelo motor de decisão, pelo conector e pelo simulador.
//
// Todos os valores são INTEIROS:
// - critério "menor_preco": centavos de real (R$ 1.234,56 = 123456);
// - critério "maior_desconto": centésimos de ponto percentual (12,34% = 1234).
// Instantes e durações são milissegundos do relógio da disputa (o motor nunca lê o relógio do sistema).

export type Criterio = "menor_preco" | "maior_desconto";

export const ESTRATEGIAS = ["cobrir", "primeiro", "posicao_alvo", "ultimos_segundos", "lance_final"] as const;
export type Estrategia = (typeof ESTRATEGIAS)[number];

export const ROTULO_ESTRATEGIA: Record<Estrategia, string> = {
  cobrir: "Cobrir o melhor lance",
  primeiro: "Ficar em 1º com o menor passo",
  posicao_alvo: "Ficar em uma posição alvo",
  ultimos_segundos: "Só lançar nos últimos segundos",
  lance_final: "Lance final único (aberto-fechado)",
};

/** Passo usado para cobrir: valor fixo (na unidade do critério) ou percentual do lance de referência (centésimos de %). */
export type Decremento = { tipo: "fixo"; valor: number } | { tipo: "percentual"; centesimos: number };

export type ConfigItem = {
  criterio: Criterio;
  /**
   * Limite que o robô nunca ultrapassa. Menor preço: valor mínimo (piso). Maior desconto: desconto máximo.
   * Obrigatório: sem ele o robô não inicia.
   */
  limite: number | null;
  estrategia: Estrategia;
  decremento: Decremento;
  /** Só para "posicao_alvo": 1 = primeiro lugar. */
  posicaoAlvo: number | null;
  /** Só para "ultimos_segundos": janela, em segundos, antes do fim previsto. */
  ultimosSegundos: number | null;
  /** Só para "lance_final": valor do lance único da fase fechada. */
  lanceFinal: number | null;
  /** Variação máxima de um lance em relação ao lance próprio anterior (centésimos de %). null = sem este limite. */
  descontoMaximoPorLance: number | null;
  maxLancesPorMinuto: number;
  /** Erros seguidos do conector que fazem o robô parar. */
  maxErrosSeguidos: number;
  /** Empresa ME/EPP: o motor apenas sinaliza empate ficto, nunca age por causa dele. */
  meEpp: boolean;
  /** Parada de emergência deste item. */
  parada: boolean;
};

/**
 * Regras de tempo e de valor da disputa. Cada edital/sistema define as suas: os números abaixo são
 * apenas padrões iniciais, configuráveis por disputa, e não descrevem a regra de nenhum portal.
 */
export type ParametrosDisputa = {
  /** Tempo mínimo entre dois lances do mesmo participante. */
  intervaloProprioMs: number;
  /** Tempo mínimo entre o registro do melhor lance e um lance que o cubra. */
  intervaloMelhorMs: number;
  /** Diferença mínima entre um lance e o lance anterior do mesmo participante. */
  diferencaPropria: number;
  /** Diferença mínima entre o melhor lance e o lance que o cobre. */
  diferencaMelhor: number;
};

export const PARAMETROS_PADRAO: ParametrosDisputa = {
  intervaloProprioMs: 20_000,
  intervaloMelhorMs: 3_000,
  diferencaPropria: 1,
  diferencaMelhor: 1,
};

/** "fechada" = etapa de lance final sigiloso do modo aberto-fechado. */
export type Fase = "aberta" | "prorrogacao" | "fechada" | "encerrada" | "suspensa";

export type EstadoDisputa = {
  agoraMs: number;
  fase: Fase;
  /** Fim previsto da fase atual (muda a cada prorrogação). */
  encerraEmMs: number | null;
  /** Melhor lance da disputa, de qualquer participante. */
  melhorLance: number | null;
  instanteMelhorLanceMs: number | null;
  meuUltimoLance: number | null;
  instanteMeuUltimoLanceMs: number | null;
  /** 1 = estou com o melhor lance. */
  minhaPosicao: number | null;
  /** Melhor lance de cada concorrente, do melhor para o pior (sem os meus). */
  lancesConcorrentes: number[];
};

/** O que o robô lembra entre uma decisão e outra. Só muda por registrarPasso/registrarErroDoConector. */
export type MemoriaRobo = {
  ultimoAgoraMs: number | null;
  /** Instantes dos lances enviados no último minuto (limite de lances por minuto e intervalo próprio). */
  instantesLances: number[];
  errosSeguidos: number;
  lanceFinalEnviado: boolean;
};

export type Controle = { paradaGlobal: boolean };

export type Acao = "lancar" | "aguardar" | "parar";

export type Regra =
  | "parada_emergencia_global"
  | "parada_emergencia_item"
  | "configuracao_invalida"
  | "erros_do_conector"
  | "estado_inconsistente"
  | "disputa_encerrada"
  | "disputa_suspensa"
  | "piso_atingido"
  | "piso_exato"
  | "cobrir"
  | "primeiro"
  | "posicao_alvo"
  | "ultimos_segundos"
  | "lance_final"
  | "ja_na_posicao"
  | "fora_da_janela"
  | "aguardar_fase"
  | "sem_espaco"
  | "limite_desconto_por_lance"
  | "intervalo_proprio"
  | "intervalo_melhor"
  | "limite_por_minuto"
  | "erro_do_conector";

export type Decisao = {
  acao: Acao;
  /** Preenchido só quando acao = "lancar". */
  valor: number | null;
  regra: Regra;
  motivo: string;
  /** Aviso informativo de empate ficto ME/EPP. Nunca altera a ação. */
  empateFicto: string | null;
};

/** Uma linha da trilha de decisões. */
export type RegistroDecisao = {
  instanteMs: number;
  estado: EstadoDisputa | null;
  acao: Acao;
  regra: Regra;
  valor: number | null;
  motivo: string;
  empateFicto: string | null;
  /** Resposta do conector ao lance, quando houve envio. */
  envio: "aceito" | "recusado" | "erro" | null;
};
