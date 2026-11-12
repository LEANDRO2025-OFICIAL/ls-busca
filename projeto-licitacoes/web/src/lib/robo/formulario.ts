// Robô de lance: leitura e validação do formulário de configuração (lógica pura).
// Os campos chegam como texto, escritos à brasileira ("1.234,56"); tudo vira inteiro aqui.
import { validarConfig } from "./motor.ts";
import type { ConfigItem, Criterio, Estrategia, ParametrosDisputa } from "./tipos.ts";
import { ESTRATEGIAS, PARAMETROS_PADRAO } from "./tipos.ts";
import { escreverCentesimos, lerCentesimos } from "./valores.ts";

export const MODOS = ["aberto", "aberto_fechado"] as const;
export type Modo = (typeof MODOS)[number];
export const ROTULO_MODO: Record<Modo, string> = { aberto: "Aberto (com prorrogação)", aberto_fechado: "Aberto-fechado (lance final)" };
export const MAX_ITENS = 30;

export type EntradaItem = {
  numeroItem: number;
  descricao: string;
  /** Proposta de partida usada na simulação. */
  valorReferencia: number;
  limite: number;
  estrategia: Estrategia;
  decrementoTipo: "fixo" | "percentual";
  decrementoValor: number;
  posicaoAlvo: number | null;
  ultimosSegundos: number | null;
  lanceFinal: number | null;
  descontoMaximoPorLance: number | null;
  maxLancesPorMinuto: number;
  maxErrosSeguidos: number;
  meEpp: boolean;
};

export type EntradaRobo = { criterio: Criterio; modo: Modo; parametros: ParametrosDisputa; itens: EntradaItem[] };

/** Item já gravado: o mesmo da entrada, com id e a parada de emergência do item. */
export type ItemGravado = EntradaItem & { id: string; parada: boolean };

export function configDoItem(criterio: Criterio, item: EntradaItem & { parada?: boolean }): ConfigItem {
  return {
    criterio,
    limite: item.limite,
    estrategia: item.estrategia,
    decremento: item.decrementoTipo === "fixo" ? { tipo: "fixo", valor: item.decrementoValor } : { tipo: "percentual", centesimos: item.decrementoValor },
    posicaoAlvo: item.estrategia === "posicao_alvo" ? item.posicaoAlvo : null,
    ultimosSegundos: item.estrategia === "ultimos_segundos" ? item.ultimosSegundos : null,
    lanceFinal: item.estrategia === "lance_final" ? item.lanceFinal : null,
    descontoMaximoPorLance: item.descontoMaximoPorLance,
    maxLancesPorMinuto: item.maxLancesPorMinuto,
    maxErrosSeguidos: item.maxErrosSeguidos,
    meEpp: item.meEpp,
    parada: item.parada ?? false,
  };
}

export type ResultadoLeitura = { ok: true; entrada: EntradaRobo } | { ok: false; erros: Record<string, string> };

/** Campos de um item no formulário: item-<i>-<campo>. */
export const campoItem = (i: number, campo: string) => `item-${i}-${campo}`;

function lerInteiro(texto: string | undefined): number | null {
  const t = (texto ?? "").trim();
  return /^\d{1,9}$/.test(t) ? Number(t) : null;
}

/**
 * Lê o formulário. `confirmacao` precisa vir marcada: salvar um robô exige confirmação explícita.
 * Devolve erros por campo (mesmo nome do campo) ou a entrada pronta para gravar.
 */
export function lerFormularioRobo(campos: Record<string, string | undefined>): ResultadoLeitura {
  const erros: Record<string, string> = {};
  const criterio: Criterio = campos.criterio === "maior_desconto" ? "maior_desconto" : "menor_preco";
  if (campos.criterio !== "menor_preco" && campos.criterio !== "maior_desconto") erros.criterio = "Escolha o critério de julgamento.";
  const modo = (MODOS as readonly string[]).includes(campos.modo ?? "") ? (campos.modo as Modo) : null;
  if (!modo) erros.modo = "Escolha o modo de disputa.";

  const segundos = (nome: string, padraoMs: number) => {
    const t = (campos[nome] ?? "").trim();
    if (t === "") return padraoMs;
    const c = lerCentesimos(t);
    if (c == null || c > 8_640_000) {
      erros[nome] = "Informe um tempo em segundos (até duas casas decimais).";
      return padraoMs;
    }
    return c * 10;
  };
  const diferenca = (nome: string, padrao: number) => {
    const t = (campos[nome] ?? "").trim();
    if (t === "") return padrao;
    const c = lerCentesimos(t);
    if (c == null) {
      erros[nome] = "Informe um valor válido (ex.: 0,01).";
      return padrao;
    }
    return c;
  };
  const parametros: ParametrosDisputa = {
    intervaloProprioMs: segundos("intervaloProprio", PARAMETROS_PADRAO.intervaloProprioMs),
    intervaloMelhorMs: segundos("intervaloMelhor", PARAMETROS_PADRAO.intervaloMelhorMs),
    diferencaPropria: diferenca("diferencaPropria", PARAMETROS_PADRAO.diferencaPropria),
    diferencaMelhor: diferenca("diferencaMelhor", PARAMETROS_PADRAO.diferencaMelhor),
  };

  const total = lerInteiro(campos.itens) ?? 0;
  if (total < 1) erros.itens = "Inclua pelo menos um item.";
  if (total > MAX_ITENS) erros.itens = `No máximo ${MAX_ITENS} itens por licitação.`;
  const itens: EntradaItem[] = [];
  const numeros = new Set<number>();
  const desconto = criterio === "maior_desconto";

  for (let i = 0; i < Math.min(total, MAX_ITENS); i++) {
    const c = (campo: string) => campos[campoItem(i, campo)];
    const erro = (campo: string, msg: string) => (erros[campoItem(i, campo)] ??= msg);
    const valor = (campo: string, obrigatorio: boolean, msg: string) => {
      const t = (c(campo) ?? "").trim();
      if (t === "") {
        if (obrigatorio) erro(campo, msg);
        return null;
      }
      const v = lerCentesimos(t);
      if (v == null) erro(campo, "Use números com até duas casas decimais (ex.: 1.234,56).");
      return v;
    };

    const numeroItem = lerInteiro(c("numero"));
    if (numeroItem == null || numeroItem < 1 || numeroItem > 9999) erro("numero", "Número do item de 1 a 9999.");
    else if (numeros.has(numeroItem)) erro("numero", "Número de item repetido.");
    else numeros.add(numeroItem);
    const descricao = (c("descricao") ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (descricao.length < 2) erro("descricao", "Descreva o item.");

    const valorReferencia = valor("referencia", true, desconto ? "Informe o desconto inicial da sua proposta." : "Informe o valor da sua proposta inicial.");
    const limite = valor("limite", true, desconto ? "O desconto máximo é obrigatório: sem ele o robô não inicia." : "O valor mínimo (piso) é obrigatório: sem ele o robô não inicia.");
    const estrategia = (ESTRATEGIAS as readonly string[]).includes(c("estrategia") ?? "") ? (c("estrategia") as Estrategia) : null;
    if (!estrategia) erro("estrategia", "Escolha a estratégia.");
    if (estrategia === "lance_final" && modo === "aberto") erro("estrategia", "Lance final único só existe no modo aberto-fechado.");
    const decrementoTipo = c("decrementoTipo") === "percentual" ? "percentual" : "fixo";
    const decrementoValor = valor("decremento", true, "Informe o passo de cada lance.");
    const inteiroOuNull = (campo: string) => {
      const t = (c(campo) ?? "").trim();
      if (t === "") return null;
      const v = lerInteiro(t);
      if (v == null) erro(campo, "Use um número inteiro.");
      return v;
    };
    const posicaoAlvo = estrategia === "posicao_alvo" ? inteiroOuNull("posicaoAlvo") : null;
    const ultimosSegundos = estrategia === "ultimos_segundos" ? inteiroOuNull("ultimosSegundos") : null;
    const lanceFinal = estrategia === "lance_final" ? valor("lanceFinal", true, "Informe o valor do lance final.") : null;
    const descontoMaximoPorLance = valor("descontoPorLance", false, "");
    const maxLancesPorMinuto = inteiroOuNull("lancesPorMinuto") ?? 6;
    const maxErrosSeguidos = inteiroOuNull("errosSeguidos") ?? 3;

    if (valorReferencia != null && limite != null) {
      if (!desconto && valorReferencia < limite) erro("referencia", "A proposta inicial não pode ficar abaixo do piso.");
      if (desconto && valorReferencia > limite) erro("referencia", "O desconto inicial não pode passar do desconto máximo.");
    }

    const item: EntradaItem = {
      numeroItem: numeroItem ?? 0,
      descricao,
      valorReferencia: valorReferencia ?? 0,
      limite: limite ?? 0,
      estrategia: estrategia ?? "cobrir",
      decrementoTipo,
      decrementoValor: decrementoValor ?? 0,
      posicaoAlvo,
      ultimosSegundos,
      lanceFinal,
      descontoMaximoPorLance,
      maxLancesPorMinuto,
      maxErrosSeguidos,
      meEpp: c("meEpp") === "on" || c("meEpp") === "1",
    };
    // As regras do próprio motor: o que ele recusaria, o formulário recusa antes de gravar.
    if (limite != null && estrategia && decrementoValor != null && Object.keys(erros).every((k) => !k.startsWith(`item-${i}-`))) {
      for (const msg of validarConfig(configDoItem(criterio, item), parametros)) {
        const campo = /piso|desconto máximo/.test(msg) && !/lance final/.test(msg) ? "limite"
          : /passo/.test(msg) ? "decremento"
          : /posição/.test(msg) ? "posicaoAlvo"
          : /segundos/.test(msg) ? "ultimosSegundos"
          : /lance final/.test(msg) ? "lanceFinal"
          : /variação/.test(msg) ? "descontoPorLance"
          : /por minuto/.test(msg) ? "lancesPorMinuto"
          : /erros seguidos/.test(msg) ? "errosSeguidos"
          : /intervalos|diferenças/.test(msg) ? null
          : "estrategia";
        if (campo) erro(campo, msg);
        else erros.parametros ??= msg;
      }
    }
    itens.push(item);
  }

  if (campos.confirmacao !== "sim") erros.confirmacao = "Confirme que revisou pisos e limites antes de salvar.";
  if (Object.keys(erros).length > 0 || !modo) return { ok: false, erros };
  return { ok: true, entrada: { criterio, modo, parametros, itens } };
}

/** Valores gravados de volta para o formulário (para editar). */
export function camposDoItem(item: EntradaItem): Record<string, string> {
  return {
    numero: String(item.numeroItem),
    descricao: item.descricao,
    referencia: escreverCentesimos(item.valorReferencia),
    limite: escreverCentesimos(item.limite),
    estrategia: item.estrategia,
    decrementoTipo: item.decrementoTipo,
    decremento: escreverCentesimos(item.decrementoValor),
    posicaoAlvo: item.posicaoAlvo == null ? "" : String(item.posicaoAlvo),
    ultimosSegundos: item.ultimosSegundos == null ? "" : String(item.ultimosSegundos),
    lanceFinal: item.lanceFinal == null ? "" : escreverCentesimos(item.lanceFinal),
    descontoPorLance: item.descontoMaximoPorLance == null ? "" : escreverCentesimos(item.descontoMaximoPorLance),
    lancesPorMinuto: String(item.maxLancesPorMinuto),
    errosSeguidos: String(item.maxErrosSeguidos),
    meEpp: item.meEpp ? "on" : "",
  };
}

export function segundosDeMs(ms: number) {
  return escreverCentesimos(Math.round(ms / 10)).replace(/,00$/, "");
}
