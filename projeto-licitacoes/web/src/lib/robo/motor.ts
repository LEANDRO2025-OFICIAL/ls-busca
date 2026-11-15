// Robô de lance: motor de decisão. Módulo PURO: sem rede, sem banco, sem relógio do sistema.
// Recebe a configuração do item, as regras da disputa, o estado observado e a memória do robô;
// devolve uma decisão (lançar, aguardar ou parar) com a regra aplicada e o motivo em português.
//
// Por dentro, tudo é comparado em um eixo único em que "menor é melhor": no critério de maior
// desconto os valores entram com o sinal trocado. Assim o piso (valor mínimo ou desconto máximo)
// é sempre o menor número que o robô pode decidir.
import type {
  ConfigItem,
  Controle,
  Decisao,
  EstadoDisputa,
  MemoriaRobo,
  ParametrosDisputa,
  RegistroDecisao,
  Regra,
} from "./tipos.ts";
import { ESTRATEGIAS } from "./tipos.ts";
import { formatarValor, fracao, VALOR_MAXIMO } from "./valores.ts";

const MINUTO_MS = 60_000;
const FASES = ["aberta", "prorrogacao", "fechada", "encerrada", "suspensa"];

export function memoriaInicial(): MemoriaRobo {
  return { ultimoAgoraMs: null, instantesLances: [], errosSeguidos: 0, lanceFinalEnviado: false };
}

const inteiro = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const duracao = (v: unknown) => inteiro(v) && v >= 0 && v <= 86_400_000;

function valorValido(v: unknown, config: Pick<ConfigItem, "criterio">): v is number {
  if (!inteiro(v)) return false;
  return config.criterio === "maior_desconto" ? v >= 0 && v <= 10_000 : v > 0 && v <= VALOR_MAXIMO;
}

/** Problemas que impedem o robô de iniciar. Lista vazia = configuração aceita. */
export function validarConfig(config: ConfigItem, parametros: ParametrosDisputa): string[] {
  const erros: string[] = [];
  const desconto = config.criterio === "maior_desconto";
  if (config.criterio !== "menor_preco" && !desconto) erros.push("Critério de julgamento desconhecido.");
  if (config.limite == null) {
    erros.push(desconto ? "Informe o desconto máximo: sem ele o robô não inicia." : "Informe o valor mínimo (piso): sem ele o robô não inicia.");
  } else if (!valorValido(config.limite, config)) {
    erros.push(desconto ? "O desconto máximo precisa estar entre 0% e 100%." : "O valor mínimo (piso) precisa ser maior que zero.");
  }
  if (!ESTRATEGIAS.includes(config.estrategia)) erros.push("Estratégia desconhecida.");
  const dec = config.decremento;
  if (dec?.tipo === "fixo") {
    if (!inteiro(dec.valor) || dec.valor < 1 || dec.valor > VALOR_MAXIMO) erros.push("O passo fixo precisa ser de pelo menos 0,01.");
  } else if (dec?.tipo === "percentual") {
    if (!inteiro(dec.centesimos) || dec.centesimos < 1 || dec.centesimos > 5_000) erros.push("O passo percentual precisa estar entre 0,01% e 50%.");
  } else {
    erros.push("Informe o passo de cada lance.");
  }
  if (config.estrategia === "posicao_alvo" && (!inteiro(config.posicaoAlvo) || config.posicaoAlvo < 1 || config.posicaoAlvo > 50)) {
    erros.push("Informe a posição alvo (1 a 50).");
  }
  if (config.estrategia === "ultimos_segundos" && (!inteiro(config.ultimosSegundos) || config.ultimosSegundos < 1 || config.ultimosSegundos > 3_600)) {
    erros.push("Informe em quantos segundos antes do fim o robô começa a lançar (1 a 3600).");
  }
  if (config.estrategia === "lance_final") {
    if (!valorValido(config.lanceFinal, config)) {
      erros.push("Informe o valor do lance final.");
    } else if (valorValido(config.limite, config) && (desconto ? config.lanceFinal > config.limite : config.lanceFinal < config.limite)) {
      erros.push(desconto ? "O lance final não pode passar do desconto máximo." : "O lance final não pode ficar abaixo do valor mínimo (piso).");
    }
  }
  if (config.descontoMaximoPorLance != null && (!inteiro(config.descontoMaximoPorLance) || config.descontoMaximoPorLance < 1 || config.descontoMaximoPorLance > 10_000)) {
    erros.push("O limite de variação por lance precisa estar entre 0,01% e 100%.");
  }
  if (!inteiro(config.maxLancesPorMinuto) || config.maxLancesPorMinuto < 1 || config.maxLancesPorMinuto > 60) {
    erros.push("O limite de lances por minuto precisa estar entre 1 e 60.");
  }
  if (!inteiro(config.maxErrosSeguidos) || config.maxErrosSeguidos < 1 || config.maxErrosSeguidos > 20) {
    erros.push("O número de erros seguidos que para o robô precisa estar entre 1 e 20.");
  }
  if (!duracao(parametros.intervaloProprioMs) || !duracao(parametros.intervaloMelhorMs)) {
    erros.push("Os intervalos mínimos entre lances precisam ser tempos válidos.");
  }
  if (!inteiro(parametros.diferencaPropria) || parametros.diferencaPropria < 0 || !inteiro(parametros.diferencaMelhor) || parametros.diferencaMelhor < 0) {
    erros.push("As diferenças mínimas entre lances não podem ser negativas.");
  }
  return erros;
}

/** Primeiro problema encontrado no estado observado, ou null. Qualquer problema faz o robô parar. */
function inconsistencia(config: ConfigItem, estado: EstadoDisputa, memoria: MemoriaRobo): string | null {
  if (!inteiro(estado.agoraMs) || estado.agoraMs < 0) return "o relógio da disputa veio inválido";
  if (memoria.ultimoAgoraMs != null && estado.agoraMs < memoria.ultimoAgoraMs) return "o relógio da disputa retrocedeu";
  if (!FASES.includes(estado.fase)) return "a fase da disputa é desconhecida";
  if (estado.fase === "encerrada" || estado.fase === "suspensa") return null;
  const { melhorLance: melhor, meuUltimoLance: meu } = estado;
  if (estado.encerraEmMs != null && !inteiro(estado.encerraEmMs)) return "o fim previsto da disputa veio inválido";
  if (melhor != null && !valorValido(melhor, config)) return "o melhor lance veio com valor inválido";
  if (meu != null && !valorValido(meu, config)) return "o seu último lance veio com valor inválido";
  if (!Array.isArray(estado.lancesConcorrentes) || estado.lancesConcorrentes.some((v) => !valorValido(v, config))) {
    return "a lista de lances dos concorrentes veio inválida";
  }
  for (const instante of [estado.instanteMelhorLanceMs, estado.instanteMeuUltimoLanceMs]) {
    if (instante != null && (!inteiro(instante) || instante > estado.agoraMs)) return "há lance registrado com horário inválido ou no futuro";
  }
  if (estado.minhaPosicao != null && (!inteiro(estado.minhaPosicao) || estado.minhaPosicao < 1)) return "a sua posição veio inválida";
  if (estado.fase === "fechada") return null;
  if (melhor == null) return "o melhor lance está ausente";
  const sinal = config.criterio === "maior_desconto" ? -1 : 1;
  if (meu != null && sinal * meu < sinal * melhor) return "o seu lance aparece melhor que o melhor lance informado";
  if (estado.minhaPosicao === 1 && meu !== melhor) return "a posição informada (1º) não combina com o melhor lance";
  return null;
}

function empateFicto(config: ConfigItem, estado: EstadoDisputa): string | null {
  const { melhorLance: melhor, meuUltimoLance: meu } = estado;
  if (!config.meEpp || config.criterio !== "menor_preco" || estado.minhaPosicao === 1) return null;
  if (!valorValido(melhor, config) || !valorValido(meu, config) || meu <= melhor) return null;
  // meu ≤ melhor × 1,05, em inteiros.
  if (BigInt(meu) * BigInt(100) > BigInt(melhor) * BigInt(105)) return null;
  return (
    `Possível empate ficto ME/EPP: seu lance (${formatarValor(meu, config.criterio)}) está até 5% acima do melhor ` +
    `(${formatarValor(melhor, config.criterio)}). Vale só se o melhor colocado não for ME/EPP; o robô apenas avisa.`
  );
}

export function decidir(
  config: ConfigItem,
  parametros: ParametrosDisputa,
  estado: EstadoDisputa,
  memoria: MemoriaRobo,
  controle: Controle,
): Decisao {
  const nucleo = decidirNucleo(config, parametros, estado, memoria, controle);
  let aviso: string | null = null;
  try {
    aviso = empateFicto(config, estado);
  } catch {
    aviso = null;
  }
  return { ...nucleo, empateFicto: aviso };
}

type Nucleo = Omit<Decisao, "empateFicto">;
const parar = (regra: Regra, motivo: string): Nucleo => ({ acao: "parar", valor: null, regra, motivo });
const aguardar = (regra: Regra, motivo: string): Nucleo => ({ acao: "aguardar", valor: null, regra, motivo });

function decidirNucleo(
  config: ConfigItem,
  parametros: ParametrosDisputa,
  estado: EstadoDisputa,
  memoria: MemoriaRobo,
  controle: Controle,
): Nucleo {
  // 1. Parada de emergência: antes de qualquer outra regra.
  if (controle.paradaGlobal) return parar("parada_emergencia_global", "Parada de emergência geral acionada.");
  if (config.parada) return parar("parada_emergencia_item", "Parada de emergência deste item acionada.");

  // 2. Sem piso (ou com configuração inválida) o robô não inicia.
  const erros = validarConfig(config, parametros);
  if (erros.length > 0 || config.limite == null) return parar("configuracao_invalida", `Configuração recusada: ${erros.join(" ")}`);

  // 3. Paradas automáticas.
  if (memoria.errosSeguidos >= config.maxErrosSeguidos) {
    return parar("erros_do_conector", `${memoria.errosSeguidos} erros seguidos do conector (limite: ${config.maxErrosSeguidos}).`);
  }
  const problema = inconsistencia(config, estado, memoria);
  if (problema) return parar("estado_inconsistente", `Estado inconsistente: ${problema}.`);
  if (estado.fase === "encerrada") return parar("disputa_encerrada", "A disputa foi encerrada.");
  if (estado.fase === "suspensa") return parar("disputa_suspensa", "A disputa foi suspensa.");

  const desconto = config.criterio === "maior_desconto";
  const sinal = desconto ? -1 : 1;
  const fmt = (n: number) => formatarValor(sinal * n, config.criterio);
  const piso = sinal * config.limite;
  const nomePiso = desconto ? "desconto máximo" : "piso";
  const agora = estado.agoraMs;
  const meu = estado.meuUltimoLance == null ? null : sinal * estado.meuUltimoLance;

  // 4. Fase fechada (aberto-fechado): no máximo um lance final, o configurado.
  if (estado.fase === "fechada") {
    if (config.estrategia !== "lance_final" || config.lanceFinal == null) {
      return aguardar("aguardar_fase", "Fase fechada: esta estratégia não envia lance final.");
    }
    if (memoria.lanceFinalEnviado) return parar("lance_final", "Lance final já enviado. Nada mais a fazer.");
    const final = sinal * config.lanceFinal;
    if (final < piso) return parar("configuracao_invalida", `O lance final ultrapassa o ${nomePiso}.`);
    if (meu != null && final >= meu) {
      return parar("lance_final", `O lance final configurado (${fmt(final)}) não melhora o seu último lance (${fmt(meu)}). Nada enviado.`);
    }
    return { acao: "lancar", valor: config.lanceFinal, regra: "lance_final", motivo: `Fase fechada: enviando o lance final único de ${fmt(final)}.` };
  }
  if (config.estrategia === "lance_final") {
    return aguardar("aguardar_fase", "Aguardando a fase fechada para enviar o lance final único.");
  }

  // 5. Fase aberta ou prorrogação: escolhe a referência a superar e o passo.
  if (estado.melhorLance == null) return parar("estado_inconsistente", "Estado inconsistente: o melhor lance está ausente.");
  const melhor = sinal * estado.melhorLance;
  const passoMinimo = Math.max(parametros.diferencaMelhor, 1);
  const tetoProprio = meu == null ? null : meu - Math.max(parametros.diferencaPropria, 1);
  let regra: Regra = config.estrategia;
  let referencia = melhor;
  let passo = passoMinimo;
  let naoPassarDe: number | null = null;

  if (config.estrategia === "posicao_alvo") {
    const alvo = config.posicaoAlvo ?? 1;
    if (estado.minhaPosicao != null && estado.minhaPosicao <= alvo) {
      return aguardar("ja_na_posicao", `Você está em ${estado.minhaPosicao}º, dentro da posição alvo (${alvo}º).`);
    }
    const concorrentes = estado.lancesConcorrentes.map((v) => sinal * v).sort((a, b) => a - b);
    if (concorrentes.length < alvo) {
      return aguardar("sem_espaco", `Há menos de ${alvo} concorrentes com lance: não há referência para a posição alvo.`);
    }
    referencia = concorrentes[alvo - 1];
    naoPassarDe = alvo >= 2 ? concorrentes[alvo - 2] : null;
  } else {
    if (config.estrategia === "ultimos_segundos") {
      if (estado.encerraEmMs == null) return parar("estado_inconsistente", "Estado inconsistente: o fim previsto da disputa está ausente.");
      const restante = estado.encerraEmMs - agora;
      const janela = (config.ultimosSegundos ?? 0) * 1000;
      if (restante > janela) {
        return aguardar("fora_da_janela", `Faltam ${Math.ceil(restante / 1000)} s para o fim previsto; o robô só lança nos últimos ${config.ultimosSegundos} s.`);
      }
    }
    if (estado.minhaPosicao === 1) return aguardar("ja_na_posicao", "Você já tem o melhor lance.");
    if (config.estrategia !== "primeiro") {
      const dec = config.decremento;
      // No critério de maior desconto, o passo "percentual" é em pontos percentuais.
      const pedido = dec.tipo === "fixo" ? dec.valor : desconto ? dec.centesimos : fracao(melhor, dec.centesimos);
      passo = Math.max(pedido, passoMinimo);
    }
  }

  let candidato = referencia - passo;
  let nota = "";
  // Diferença mínima em relação ao próprio lance anterior.
  if (tetoProprio != null && candidato > tetoProprio) candidato = tetoProprio;
  if (naoPassarDe != null && candidato <= naoPassarDe) {
    return aguardar("sem_espaco", `Não há espaço entre a ${config.posicaoAlvo! - 1}ª e a ${config.posicaoAlvo}ª posição para um lance válido.`);
  }

  // Limite de variação por lance, medido sobre o próprio lance anterior (ou o melhor, se ainda não lançou).
  if (config.descontoMaximoPorLance != null) {
    const base = meu ?? melhor;
    const maximo = desconto ? config.descontoMaximoPorLance : fracao(base, config.descontoMaximoPorLance);
    const limitado = base - maximo;
    if (candidato < limitado) {
      const serve = limitado <= referencia - passoMinimo && (tetoProprio == null || limitado <= tetoProprio);
      if (!serve) {
        return aguardar(
          "limite_desconto_por_lance",
          `Superar ${fmt(referencia)} exigiria variar mais que o limite por lance (${formatarValor(config.descontoMaximoPorLance, "maior_desconto")}). Nenhum lance enviado.`,
        );
      }
      candidato = limitado;
      nota = " Valor contido pelo limite de variação por lance.";
    }
  }

  // Piso: nunca abaixo dele. Se o piso exato ainda supera a referência, lança o piso; senão, para.
  if (candidato < piso) {
    const serve = piso <= referencia - passoMinimo && (tetoProprio == null || piso <= tetoProprio);
    if (!serve) {
      return parar("piso_atingido", `Não é possível superar ${fmt(referencia)} sem ultrapassar o ${nomePiso} de ${fmt(piso)}. Robô parado.`);
    }
    candidato = piso;
    regra = "piso_exato";
    nota = ` Lance no ${nomePiso} exato: é o último possível.`;
  }

  // Defesa em profundidade: nada sai daqui fora dos limites, mesmo que haja um erro acima.
  if (!Number.isSafeInteger(candidato) || candidato < piso || candidato > referencia - passoMinimo || (tetoProprio != null && candidato > tetoProprio)) {
    return parar("estado_inconsistente", "Estado inconsistente: o cálculo do lance saiu dos limites. Nenhum lance enviado.");
  }

  // Tempo: intervalo entre lances próprios, intervalo após o melhor lance e limite por minuto.
  const ultimoEnvio = memoria.instantesLances.length > 0 ? Math.max(...memoria.instantesLances) : null;
  const ultimoProprio = Math.max(estado.instanteMeuUltimoLanceMs ?? -Infinity, ultimoEnvio ?? -Infinity);
  if (agora - ultimoProprio < parametros.intervaloProprioMs) {
    const falta = parametros.intervaloProprioMs - (agora - ultimoProprio);
    return aguardar("intervalo_proprio", `Aguardando ${Math.ceil(falta / 1000)} s: intervalo mínimo entre lances próprios.`);
  }
  if (candidato < melhor && estado.instanteMelhorLanceMs != null && agora - estado.instanteMelhorLanceMs < parametros.intervaloMelhorMs) {
    const falta = parametros.intervaloMelhorMs - (agora - estado.instanteMelhorLanceMs);
    return aguardar("intervalo_melhor", `Aguardando ${Math.ceil(falta / 1000)} s: intervalo mínimo após o melhor lance.`);
  }
  const noMinuto = memoria.instantesLances.filter((t) => t > agora - MINUTO_MS).length;
  if (noMinuto >= config.maxLancesPorMinuto) {
    return aguardar("limite_por_minuto", `Limite de ${config.maxLancesPorMinuto} lance(s) por minuto atingido.`);
  }

  const alvoTexto = config.estrategia === "posicao_alvo" ? `ficar em ${config.posicaoAlvo}º` : "ficar em 1º";
  return {
    acao: "lancar",
    valor: sinal * candidato,
    regra,
    motivo: `Lance de ${fmt(candidato)} para superar ${fmt(referencia)} e ${alvoTexto}.${nota}`,
  };
}

/** Memória após um passo. `envio` é a resposta do conector quando a decisão foi lançar. */
export function registrarPasso(
  memoria: MemoriaRobo,
  estado: EstadoDisputa,
  decisao: Decisao,
  envio: RegistroDecisao["envio"],
): MemoriaRobo {
  const agora = inteiro(estado.agoraMs) ? Math.max(estado.agoraMs, memoria.ultimoAgoraMs ?? 0) : memoria.ultimoAgoraMs;
  const nova: MemoriaRobo = { ...memoria, ultimoAgoraMs: agora, errosSeguidos: 0 };
  if (decisao.acao !== "lancar") return nova;
  if (envio === "erro") nova.errosSeguidos = memoria.errosSeguidos + 1;
  // Aceito, recusado ou com erro (o lance pode ter chegado), o envio conta para o intervalo e o limite por minuto.
  const corte = (agora ?? 0) - MINUTO_MS;
  nova.instantesLances = [...memoria.instantesLances.filter((t) => t > corte), agora ?? 0];
  if (decisao.regra === "lance_final" && envio === "aceito") nova.lanceFinalEnviado = true;
  return nova;
}

/** Falha ao observar a disputa: conta o erro e diz se o robô segue (aguardar) ou para. */
export function registrarErroDoConector(
  config: ConfigItem,
  memoria: MemoriaRobo,
  detalhe: string,
): { memoria: MemoriaRobo; registro: RegistroDecisao } {
  const errosSeguidos = memoria.errosSeguidos + 1;
  const limite = inteiro(config.maxErrosSeguidos) && config.maxErrosSeguidos >= 1 ? config.maxErrosSeguidos : 1;
  const parou = errosSeguidos >= limite;
  return {
    memoria: { ...memoria, errosSeguidos },
    registro: {
      instanteMs: memoria.ultimoAgoraMs ?? 0,
      estado: null,
      acao: parou ? "parar" : "aguardar",
      regra: parou ? "erros_do_conector" : "erro_do_conector",
      valor: null,
      motivo: parou
        ? `${errosSeguidos} erros seguidos do conector (limite: ${limite}). Robô parado. Último erro: ${detalhe}`
        : `Erro do conector (${errosSeguidos} de ${limite}): ${detalhe}`,
      empateFicto: null,
      envio: null,
    },
  };
}

export function montarRegistro(estado: EstadoDisputa, decisao: Decisao, envio: RegistroDecisao["envio"]): RegistroDecisao {
  return {
    instanteMs: estado.agoraMs,
    estado,
    acao: decisao.acao,
    regra: decisao.regra,
    valor: decisao.valor,
    motivo: decisao.motivo,
    empateFicto: decisao.empateFicto,
    envio,
  };
}
