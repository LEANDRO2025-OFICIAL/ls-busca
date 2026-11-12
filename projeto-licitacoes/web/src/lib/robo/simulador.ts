// Robô de lance: simulador de disputa. É a única implementação de ConectorDeDisputa do projeto.
// Tudo é fictício e determinístico: concorrentes inventados, relógio virtual e sorteios por semente.
// A mesma semente e o mesmo cenário produzem sempre a mesma disputa. Nada aqui fala com portal algum.
import type { ConectorDeDisputa, ResultadoEnvio } from "./conector.ts";
import { executarRobo } from "./conector.ts";
import type { ConfigItem, Controle, Criterio, EstadoDisputa, Fase, ParametrosDisputa, RegistroDecisao } from "./tipos.ts";
import { formatarValor, fracao, VALOR_MAXIMO } from "./valores.ts";

export const PERFIS = ["agressivo", "conservador", "desistente"] as const;
/**
 * agressivo: reage rápido, com passos grandes, e vai até o próprio piso;
 * conservador: demora e baixa o mínimo possível, também até o próprio piso;
 * desistente: acompanha, mas abandona a disputa quando teria de passar do próprio piso.
 */
export type Perfil = (typeof PERFIS)[number];

export type ConcorrenteSimulado = { nome: string; perfil: Perfil; lanceInicial: number; pisoProprio: number };

export type Cenario = {
  semente: number;
  criterio: Criterio;
  /** "aberto": fase aberta e prorrogações. "aberto_fechado": fase aberta e depois um lance final sigiloso. */
  modo: "aberto" | "aberto_fechado";
  duracaoAbertaMs: number;
  /** Modo aberto: a disputa só encerra depois deste tempo sem nenhum lance. */
  prorrogacaoMs: number;
  duracaoFechadaMs: number;
  /** Teto de segurança: a disputa encerra aqui de qualquer jeito. */
  duracaoMaximaMs: number;
  meuLanceInicial: number;
  concorrentes: ConcorrenteSimulado[];
  parametros: ParametrosDisputa;
  /** Chance (0 a 1), a cada minuto, de a disputa ser suspensa. 0 desliga. */
  chanceSuspensaoPorMinuto: number;
  /** Chance (0 a 1) de cada chamada ao conector falhar. 0 desliga. */
  chanceErroConector: number;
};

export type EventoSimulado = {
  instanteMs: number;
  tipo: "lance" | "lance_final" | "recusado" | "fase" | "desistencia";
  autor: string | null;
  proprio: boolean;
  valor: number | null;
  fase: Fase;
  texto: string;
};

export type Classificado = { posicao: number; nome: string; proprio: boolean; valor: number; desistiu: boolean };

export type ResultadoSimulado = {
  fase: Fase;
  duracaoMs: number;
  classificacao: Classificado[];
  minhaPosicao: number;
  meuValor: number;
  melhorValor: number;
  totalLances: number;
  meusLances: number;
  recusas: number;
};

export const NOME_PROPRIO = "Você";

/** Gerador pseudoaleatório pequeno e determinístico (mulberry32). */
export function criarGerador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Participante = {
  nome: string;
  proprio: boolean;
  perfil: Perfil | null;
  /** Melhor lance, no eixo interno em que menor é melhor. */
  melhor: number;
  instanteMelhorMs: number;
  ultimoLanceMs: number | null;
  piso: number;
  desistiu: boolean;
  proximaAcaoMs: number;
  lanceFechado: number | null;
  instanteFechadoMs: number | null;
};

const MINUTO_MS = 60_000;

export class SimuladorDeDisputa implements ConectorDeDisputa {
  private readonly cenario: Cenario;
  private readonly sinal: 1 | -1;
  private readonly sorteio: () => number;
  private readonly participantes: Participante[];
  private readonly eventos: EventoSimulado[] = [];
  private agora = 0;
  private fase: Fase = "aberta";
  private encerraEm: number;
  private ultimoLanceGeral: number | null = null;
  private proximaChecagemSuspensao = MINUTO_MS;
  private totalLances = 0;
  private recusas = 0;

  constructor(cenario: Cenario) {
    const problemas = validarCenario(cenario);
    if (problemas.length > 0) throw new Error(`Cenário de simulação inválido: ${problemas.join(" ")}`);
    this.cenario = cenario;
    this.sinal = cenario.criterio === "maior_desconto" ? -1 : 1;
    this.sorteio = criarGerador(cenario.semente);
    this.encerraEm = cenario.duracaoAbertaMs;
    const novo = (nome: string, proprio: boolean, perfil: Perfil | null, inicial: number, piso: number): Participante => ({
      nome,
      proprio,
      perfil,
      melhor: this.sinal * inicial,
      instanteMelhorMs: 0,
      ultimoLanceMs: null,
      piso: this.sinal * piso,
      desistiu: false,
      proximaAcaoMs: 0,
      lanceFechado: null,
      instanteFechadoMs: null,
    });
    this.participantes = [
      novo(NOME_PROPRIO, true, null, cenario.meuLanceInicial, cenario.meuLanceInicial),
      ...cenario.concorrentes.map((c) => novo(c.nome, false, c.perfil, c.lanceInicial, c.pisoProprio)),
    ];
    for (const p of this.participantes) if (!p.proprio) p.proximaAcaoMs = this.atraso(p);
    this.evento("fase", null, null, "Disputa aberta com as propostas iniciais.");
  }

  // ---------- ConectorDeDisputa ----------

  async observar(): Promise<EstadoDisputa> {
    this.talvezFalhar("observar a disputa");
    return this.estado();
  }

  async enviarLance(valor: number): Promise<ResultadoEnvio> {
    this.talvezFalhar("enviar o lance");
    const eu = this.participantes[0];
    const recusar = (motivo: string): ResultadoEnvio => {
      this.recusas++;
      this.evento("recusado", eu, Number.isSafeInteger(valor) ? valor : null, `Lance recusado: ${motivo}`);
      return { aceito: false, motivo };
    };
    if (this.fase === "encerrada" || this.fase === "suspensa") return recusar("a disputa não está recebendo lances.");
    const desconto = this.sinal === -1;
    if (!Number.isSafeInteger(valor) || (desconto ? valor < 0 || valor > 10_000 : valor <= 0 || valor > VALOR_MAXIMO)) {
      return recusar("valor inválido.");
    }
    const n = this.sinal * valor;
    if (this.fase === "fechada") {
      if (eu.lanceFechado != null) return recusar("o lance final já foi enviado.");
      if (n >= eu.melhor) return recusar("o lance final precisa melhorar o seu último lance.");
      eu.lanceFechado = n;
      eu.instanteFechadoMs = this.agora;
      this.totalLances++;
      this.evento("lance_final", eu, valor, "Lance final sigiloso enviado.");
      return { aceito: true };
    }
    const p = this.cenario.parametros;
    if (eu.ultimoLanceMs != null && this.agora - eu.ultimoLanceMs < p.intervaloProprioMs) {
      return recusar("intervalo mínimo entre lances próprios não respeitado.");
    }
    if (eu.melhor - n < Math.max(p.diferencaPropria, 1)) return recusar("diferença mínima em relação ao seu lance anterior não respeitada.");
    const lider = this.ordenados()[0];
    if (n < lider.melhor) {
      if (lider.melhor - n < Math.max(p.diferencaMelhor, 1)) return recusar("diferença mínima em relação ao melhor lance não respeitada.");
      if (this.agora - lider.instanteMelhorMs < p.intervaloMelhorMs) return recusar("intervalo mínimo após o melhor lance não respeitado.");
    }
    this.registrarLance(eu, n);
    return { aceito: true };
  }

  // ---------- relógio virtual ----------

  /** Avança o relógio virtual, processando no caminho tudo o que acontece na disputa. */
  async avancar(ms: number): Promise<void> {
    const alvo = this.agora + Math.max(0, Math.trunc(ms));
    while (!this.terminou()) {
      const proximo = this.proximoAcontecimento();
      if (proximo > alvo) break;
      this.agora = Math.max(this.agora, proximo);
      this.processar();
    }
    this.agora = alvo;
  }

  /** Roda até a disputa encerrar ou ser suspensa (o teto de duração garante o fim). */
  async avancarAteOFim(): Promise<void> {
    while (!this.terminou()) await this.avancar(MINUTO_MS);
  }

  terminou() {
    return this.fase === "encerrada" || this.fase === "suspensa";
  }

  linhaDoTempo(): EventoSimulado[] {
    return this.eventos.map((e) => ({ ...e }));
  }

  resultado(): ResultadoSimulado {
    const ordem = this.ordenados();
    const eu = this.participantes[0];
    return {
      fase: this.fase,
      duracaoMs: this.agora,
      classificacao: ordem.map((p, i) => ({ posicao: i + 1, nome: p.nome, proprio: p.proprio, valor: this.sinal * p.melhor, desistiu: p.desistiu })),
      minhaPosicao: ordem.indexOf(eu) + 1,
      meuValor: this.sinal * eu.melhor,
      melhorValor: this.sinal * ordem[0].melhor,
      totalLances: this.totalLances,
      meusLances: this.eventos.filter((e) => e.proprio && (e.tipo === "lance" || e.tipo === "lance_final")).length,
      recusas: this.recusas,
    };
  }

  // ---------- por dentro ----------

  private estado(): EstadoDisputa {
    const ordem = this.ordenados();
    const eu = this.participantes[0];
    return {
      agoraMs: this.agora,
      fase: this.fase,
      encerraEmMs: this.terminou() ? null : this.encerraEm,
      melhorLance: this.sinal * ordem[0].melhor,
      instanteMelhorLanceMs: ordem[0].instanteMelhorMs,
      meuUltimoLance: this.sinal * eu.melhor,
      instanteMeuUltimoLanceMs: eu.ultimoLanceMs,
      minhaPosicao: ordem.indexOf(eu) + 1,
      lancesConcorrentes: ordem.filter((p) => !p.proprio).map((p) => this.sinal * p.melhor),
    };
  }

  private ordenados(): Participante[] {
    return [...this.participantes].sort((a, b) => a.melhor - b.melhor || a.instanteMelhorMs - b.instanteMelhorMs || Number(b.proprio) - Number(a.proprio));
  }

  private talvezFalhar(oQue: string) {
    if (this.cenario.chanceErroConector > 0 && this.sorteio() < this.cenario.chanceErroConector) {
      throw new Error(`Falha simulada de comunicação ao ${oQue}.`);
    }
  }

  private entre(min: number, max: number) {
    return min + Math.floor(this.sorteio() * (max - min + 1));
  }

  private atraso(p: Participante) {
    if (p.perfil === "agressivo") return this.entre(4_000, 12_000);
    if (p.perfil === "conservador") return this.entre(20_000, 45_000);
    return this.entre(8_000, 20_000);
  }

  private evento(tipo: EventoSimulado["tipo"], autor: Participante | null, valor: number | null, texto: string) {
    this.eventos.push({ instanteMs: this.agora, tipo, autor: autor?.nome ?? null, proprio: autor?.proprio ?? false, valor, fase: this.fase, texto });
  }

  private registrarLance(p: Participante, n: number) {
    p.melhor = n;
    p.instanteMelhorMs = this.agora;
    p.ultimoLanceMs = this.agora;
    this.ultimoLanceGeral = this.agora;
    this.totalLances++;
    const posicao = this.ordenados().indexOf(p) + 1;
    this.evento("lance", p, this.sinal * n, `${p.nome}: ${formatarValor(this.sinal * n, this.cenario.criterio)} (${posicao}º).`);
    // Na prorrogação, cada lance empurra o fim.
    if (this.fase === "prorrogacao") this.encerraEm = Math.min(this.agora + this.cenario.prorrogacaoMs, this.cenario.duracaoMaximaMs);
  }

  private proximoAcontecimento(): number {
    let proximo = Math.min(this.encerraEm, this.cenario.duracaoMaximaMs);
    if (this.cenario.chanceSuspensaoPorMinuto > 0) proximo = Math.min(proximo, this.proximaChecagemSuspensao);
    for (const p of this.participantes) {
      if (!p.proprio && !p.desistiu && (this.fase !== "fechada" || p.lanceFechado == null)) proximo = Math.min(proximo, p.proximaAcaoMs);
    }
    return Math.max(proximo, this.agora);
  }

  /** Processa o que vence neste instante: fim de fase, sorteio de suspensão e a vez de cada concorrente. */
  private processar() {
    const c = this.cenario;
    if (this.agora >= c.duracaoMaximaMs) return this.encerrar("Disputa encerrada pelo tempo máximo da simulação.");
    if (this.agora >= this.encerraEm) return this.fimDeFase();
    if (c.chanceSuspensaoPorMinuto > 0 && this.agora >= this.proximaChecagemSuspensao) {
      this.proximaChecagemSuspensao += MINUTO_MS;
      if (this.sorteio() < c.chanceSuspensaoPorMinuto) {
        this.fase = "suspensa";
        this.evento("fase", null, null, "Disputa suspensa pelo condutor (evento sorteado da simulação).");
        return;
      }
    }
    for (const p of this.participantes) {
      if (p.proprio || p.desistiu || p.proximaAcaoMs > this.agora) continue;
      if (this.fase === "fechada") this.lanceFechadoDoConcorrente(p);
      else this.vezDoConcorrente(p);
    }
  }

  private fimDeFase() {
    const c = this.cenario;
    if (this.fase === "aberta" && c.modo === "aberto_fechado") {
      this.fase = "fechada";
      this.encerraEm = Math.min(this.agora + c.duracaoFechadaMs, c.duracaoMaximaMs);
      for (const p of this.participantes) if (!p.proprio) p.proximaAcaoMs = this.agora + this.entre(1_000, Math.max(1_000, c.duracaoFechadaMs - 1_000));
      this.evento("fase", null, null, "Fase aberta encerrada. Começa a fase fechada: um lance final sigiloso por participante.");
      return;
    }
    if (this.fase === "fechada") {
      for (const p of this.participantes) {
        if (p.lanceFechado != null && p.lanceFechado < p.melhor) {
          p.melhor = p.lanceFechado;
          p.instanteMelhorMs = p.instanteFechadoMs ?? this.agora;
        }
      }
      return this.encerrar("Fase fechada encerrada: lances finais abertos.");
    }
    if (this.fase === "aberta" && c.prorrogacaoMs > 0 && this.ultimoLanceGeral != null && this.ultimoLanceGeral > this.agora - c.prorrogacaoMs) {
      this.fase = "prorrogacao";
      this.encerraEm = Math.min(this.ultimoLanceGeral + c.prorrogacaoMs, c.duracaoMaximaMs);
      this.evento("fase", null, null, "Houve lance no fim do tempo: disputa em prorrogação.");
      return;
    }
    this.encerrar("Disputa encerrada: tempo esgotado sem novos lances.");
  }

  private encerrar(texto: string) {
    this.fase = "encerrada";
    this.evento("fase", null, null, texto);
  }

  private vezDoConcorrente(p: Participante) {
    const regras = this.cenario.parametros;
    const lider = this.ordenados()[0];
    if (lider === p) {
      p.proximaAcaoMs = this.agora + this.atraso(p);
      return;
    }
    // Respeita as mesmas regras de tempo que valem para o robô.
    const liberado = Math.max(
      p.ultimoLanceMs == null ? 0 : p.ultimoLanceMs + regras.intervaloProprioMs,
      lider.instanteMelhorMs + regras.intervaloMelhorMs,
    );
    if (liberado > this.agora) {
      p.proximaAcaoMs = liberado;
      return;
    }
    const minimo = Math.max(regras.diferencaMelhor, 1);
    const desconto = this.sinal === -1;
    const passo =
      p.perfil === "conservador"
        ? minimo + (desconto ? this.entre(0, 5) : fracao(lider.melhor, this.entre(0, 10)))
        : p.perfil === "agressivo"
          ? (desconto ? this.entre(10, 60) : fracao(lider.melhor, this.entre(30, 120)))
          : (desconto ? this.entre(5, 30) : fracao(lider.melhor, this.entre(20, 60)));
    let candidato = Math.min(lider.melhor - Math.max(passo, minimo), p.melhor - Math.max(regras.diferencaPropria, 1));
    if (candidato < p.piso) {
      const pisoServe = p.perfil !== "desistente" && p.piso <= lider.melhor - minimo && p.piso <= p.melhor - Math.max(regras.diferencaPropria, 1);
      if (!pisoServe) {
        p.desistiu = true;
        this.evento("desistencia", p, null, `${p.nome} parou de dar lances.`);
        return;
      }
      candidato = p.piso;
    }
    this.registrarLance(p, candidato);
    p.proximaAcaoMs = this.agora + this.atraso(p);
  }

  private lanceFechadoDoConcorrente(p: Participante) {
    const folga = p.melhor - p.piso;
    // O desistente mantém o que já ofertou; os outros gastam parte da folga até o próprio piso.
    const corte = p.perfil === "desistente" || folga <= 0 ? 0 : Math.floor((folga * this.entre(p.perfil === "agressivo" ? 60 : 10, p.perfil === "agressivo" ? 100 : 40)) / 100);
    p.lanceFechado = corte > 0 ? p.melhor - corte : p.melhor;
    p.instanteFechadoMs = this.agora;
    if (corte > 0) {
      this.totalLances++;
      this.evento("lance_final", p, null, `${p.nome} enviou um lance final sigiloso.`);
    }
  }
}

export function validarCenario(c: Cenario): string[] {
  const erros: string[] = [];
  const desconto = c.criterio === "maior_desconto";
  const valor = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && (desconto ? v >= 0 && v <= 10_000 : v > 0 && v <= VALOR_MAXIMO);
  const tempo = (v: unknown, min: number) => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= 24 * 60 * MINUTO_MS;
  const chance = (v: unknown) => typeof v === "number" && v >= 0 && v <= 1;
  if (!Number.isSafeInteger(c.semente)) erros.push("A semente precisa ser um número inteiro.");
  if (c.modo !== "aberto" && c.modo !== "aberto_fechado") erros.push("Modo de disputa desconhecido.");
  if (!tempo(c.duracaoAbertaMs, 1_000)) erros.push("Duração da fase aberta inválida.");
  if (!tempo(c.prorrogacaoMs, 0)) erros.push("Tempo de prorrogação inválido.");
  if (!tempo(c.duracaoFechadaMs, 0) || (c.modo === "aberto_fechado" && c.duracaoFechadaMs < 2_000)) erros.push("Duração da fase fechada inválida.");
  if (!tempo(c.duracaoMaximaMs, 1_000) || c.duracaoMaximaMs < c.duracaoAbertaMs) erros.push("Duração máxima inválida.");
  if (!valor(c.meuLanceInicial)) erros.push("Proposta inicial inválida.");
  if (!Array.isArray(c.concorrentes) || c.concorrentes.length < 1 || c.concorrentes.length > 20) erros.push("Informe de 1 a 20 concorrentes.");
  for (const k of c.concorrentes ?? []) {
    if (!PERFIS.includes(k.perfil)) erros.push(`Perfil desconhecido para ${k.nome}.`);
    if (!valor(k.lanceInicial) || !valor(k.pisoProprio) || (desconto ? k.pisoProprio < k.lanceInicial : k.pisoProprio > k.lanceInicial)) {
      erros.push(`Valores inválidos para ${k.nome}.`);
    }
  }
  if (!chance(c.chanceSuspensaoPorMinuto) || !chance(c.chanceErroConector)) erros.push("As chances precisam estar entre 0 e 1.");
  return erros;
}

export type PedidoDeCenario = {
  semente: number;
  criterio: Criterio;
  modo: Cenario["modo"];
  /** Menor preço: valor de partida da disputa (centavos). Maior desconto: desconto de partida (centésimos de %). */
  valorDePartida: number;
  perfis: Perfil[];
  duracaoAbertaMs: number;
  parametros: ParametrosDisputa;
  chanceSuspensaoPorMinuto?: number;
  chanceErroConector?: number;
};

const NOMES = ["Fornecedor A", "Fornecedor B", "Fornecedor C", "Fornecedor D", "Fornecedor E", "Fornecedor F", "Fornecedor G", "Fornecedor H"];

/** Monta um cenário plausível em torno de um valor de partida. Propostas e pisos dos concorrentes saem da semente. */
export function montarCenario(pedido: PedidoDeCenario): Cenario {
  // Sorteios do cenário em sequência própria, para não se misturarem com os da disputa.
  const sorteio = criarGerador((pedido.semente ^ 0x5bd1e995) >>> 0);
  const entre = (min: number, max: number) => min + Math.floor(sorteio() * (max - min + 1));
  const desconto = pedido.criterio === "maior_desconto";
  const partida = pedido.valorDePartida;
  const concorrentes = pedido.perfis.slice(0, NOMES.length).map((perfil, i): ConcorrenteSimulado => {
    // Faixas de folga até o piso próprio, por perfil (em centésimos de %).
    const [min, max] = perfil === "agressivo" ? [1_200, 2_200] : perfil === "conservador" ? [700, 1_500] : [200, 700];
    if (desconto) {
      const inicial = Math.min(10_000, partida + entre(0, 150));
      return { nome: NOMES[i], perfil, lanceInicial: inicial, pisoProprio: Math.min(10_000, inicial + entre(min, max)) };
    }
    const inicial = Math.max(2, partida - fracao(partida, entre(0, 300)));
    return { nome: NOMES[i], perfil, lanceInicial: inicial, pisoProprio: Math.max(1, inicial - fracao(inicial, entre(min, max))) };
  });
  return {
    semente: pedido.semente,
    criterio: pedido.criterio,
    modo: pedido.modo,
    duracaoAbertaMs: pedido.duracaoAbertaMs,
    prorrogacaoMs: 2 * MINUTO_MS,
    duracaoFechadaMs: 5 * MINUTO_MS,
    duracaoMaximaMs: pedido.duracaoAbertaMs + 60 * MINUTO_MS,
    meuLanceInicial: partida,
    concorrentes,
    parametros: pedido.parametros,
    chanceSuspensaoPorMinuto: pedido.chanceSuspensaoPorMinuto ?? 0,
    chanceErroConector: pedido.chanceErroConector ?? 0,
  };
}

export type Simulacao = {
  registros: RegistroDecisao[];
  linhaDoTempo: EventoSimulado[];
  resultado: ResultadoSimulado;
  parouPeloMotor: boolean;
};

/** Roda uma disputa simulada inteira com o motor de decisão. Leva milissegundos: o relógio é virtual. */
export async function simularDisputa(
  config: ConfigItem,
  cenario: Cenario,
  controle: () => Controle | Promise<Controle>,
  passoMs = 1000,
): Promise<Simulacao> {
  const simulador = new SimuladorDeDisputa(cenario);
  const execucao = await executarRobo({
    conector: simulador,
    config,
    parametros: cenario.parametros,
    controle,
    esperar: (ms) => simulador.avancar(ms),
    passoMs,
    maxPassos: Math.ceil(cenario.duracaoMaximaMs / passoMs) + 10,
  });
  // O robô pode ter parado antes (piso, parada de emergência): a disputa segue sem ele até o fim.
  await simulador.avancarAteOFim();
  return {
    registros: execucao.registros,
    linhaDoTempo: simulador.linhaDoTempo(),
    resultado: simulador.resultado(),
    parouPeloMotor: execucao.parouPeloMotor,
  };
}

/** Junta esperas repetidas (mesma regra, uma após a outra) em uma só linha, para a trilha ficar legível. */
export function compactarTrilha(registros: RegistroDecisao[]): (RegistroDecisao & { repeticoes: number; ateMs: number })[] {
  const saida: (RegistroDecisao & { repeticoes: number; ateMs: number })[] = [];
  for (const r of registros) {
    const anterior = saida[saida.length - 1];
    if (anterior && r.acao === "aguardar" && anterior.acao === "aguardar" && anterior.regra === r.regra) {
      anterior.repeticoes++;
      anterior.ateMs = r.instanteMs;
      continue;
    }
    saida.push({ ...r, repeticoes: 1, ateMs: r.instanteMs });
  }
  return saida;
}
