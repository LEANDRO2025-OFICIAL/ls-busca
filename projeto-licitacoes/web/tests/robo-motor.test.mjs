// Robô de lance: motor de decisão (lógica pura de src/lib/robo/motor.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { decidir, memoriaInicial, registrarErroDoConector, registrarPasso, validarConfig } from "../src/lib/robo/motor.ts";
import { PARAMETROS_PADRAO } from "../src/lib/robo/tipos.ts";
import { escreverCentesimos, formatarValor, fracao, lerCentesimos } from "../src/lib/robo/valores.ts";

const config = (c = {}) => ({
  criterio: "menor_preco",
  limite: 80_000_00,
  estrategia: "cobrir",
  decremento: { tipo: "fixo", valor: 50_00 },
  posicaoAlvo: null,
  ultimosSegundos: null,
  lanceFinal: null,
  descontoMaximoPorLance: null,
  maxLancesPorMinuto: 10,
  maxErrosSeguidos: 3,
  meEpp: false,
  parada: false,
  ...c,
});
// Disputa em andamento: o melhor é de um concorrente (R$ 95.000,00) e eu estou em 2º com R$ 96.000,00.
const estado = (e = {}) => ({
  agoraMs: 300_000,
  fase: "aberta",
  encerraEmMs: 600_000,
  melhorLance: 95_000_00,
  instanteMelhorLanceMs: 200_000,
  meuUltimoLance: 96_000_00,
  instanteMeuUltimoLanceMs: 100_000,
  minhaPosicao: 2,
  lancesConcorrentes: [95_000_00, 97_000_00, 99_000_00],
  ...e,
});
const LIVRE = { paradaGlobal: false };
const rodar = (c = {}, e = {}, m = {}, p = {}, controle = LIVRE) =>
  decidir(config(c), { ...PARAMETROS_PADRAO, ...p }, estado(e), { ...memoriaInicial(), ...m }, controle);

// ---------- valores em centavos ----------

test("lê e escreve valores em centavos sem ponto flutuante", () => {
  assert.equal(lerCentesimos("1.234,56"), 123456);
  assert.equal(lerCentesimos("R$ 1234,5"), 123450);
  assert.equal(lerCentesimos("0,07"), 7);
  assert.equal(lerCentesimos("19,99"), 1999);
  assert.equal(lerCentesimos("2,5%"), 250);
  assert.equal(lerCentesimos("1.000.000"), 100_000_000);
  for (const ruim of ["", "abc", "1,234", "1.23,00", "-5", "1e3", "12.34"]) assert.equal(lerCentesimos(ruim), null, ruim);
  assert.equal(escreverCentesimos(123456), "1.234,56");
  assert.equal(escreverCentesimos(7), "0,07");
  assert.equal(formatarValor(100_000_000_00, "menor_preco"), "R$ 100.000.000,00");
  assert.equal(formatarValor(1234, "maior_desconto"), "12,34%");
  // Ida e volta em valores que em ponto flutuante dariam erro (0,1 + 0,2 etc.).
  for (const v of [1, 10, 29, 30, 57, 1999, 100_01, 999_999_99, 123_456_789_01]) assert.equal(lerCentesimos(escreverCentesimos(v)), v);
  assert.equal(fracao(999_999_999_99, 3333), 33_329_999_999); // exato mesmo com produto acima de 2^53
});

// ---------- piso obrigatório ----------

test("sem piso o robô não inicia", () => {
  const d = rodar({ limite: null });
  assert.equal(d.acao, "parar");
  assert.equal(d.regra, "configuracao_invalida");
  assert.match(d.motivo, /piso/);
  for (const limite of [0, -1, 10.5, Number.NaN, "100"]) assert.equal(rodar({ limite }).acao, "parar", String(limite));
  assert.deepEqual(validarConfig(config(), PARAMETROS_PADRAO), []);
});

test("validação da configuração aponta cada campo errado", () => {
  const erros = (c, p = {}) => validarConfig(config(c), { ...PARAMETROS_PADRAO, ...p }).join(" | ");
  assert.match(erros({ decremento: { tipo: "fixo", valor: 0 } }), /passo fixo/);
  assert.match(erros({ decremento: { tipo: "percentual", centesimos: 6000 } }), /passo percentual/);
  assert.match(erros({ estrategia: "posicao_alvo" }), /posição alvo/);
  assert.match(erros({ estrategia: "ultimos_segundos" }), /segundos/);
  assert.match(erros({ estrategia: "lance_final" }), /lance final/);
  assert.match(erros({ estrategia: "lance_final", lanceFinal: 79_999_99 }), /abaixo do valor mínimo/);
  assert.match(erros({ estrategia: "inventada" }), /Estratégia/);
  assert.match(erros({ maxLancesPorMinuto: 0 }), /por minuto/);
  assert.match(erros({ maxErrosSeguidos: 0 }), /erros seguidos/);
  assert.match(erros({ descontoMaximoPorLance: 0 }), /variação por lance/);
  assert.match(erros({}, { diferencaMelhor: -1 }), /diferenças mínimas/);
  assert.match(erros({}, { intervaloProprioMs: -5 }), /intervalos/);
  assert.match(erros({ criterio: "maior_desconto", limite: 10_001 }), /desconto máximo/);
});

// ---------- estratégias ----------

test("cobrir por decremento fixo", () => {
  const d = rodar();
  assert.deepEqual([d.acao, d.valor, d.regra], ["lancar", 94_950_00, "cobrir"]);
  assert.match(d.motivo, /R\$ 94\.950,00/);
});

test("cobrir por decremento percentual arredonda em centavos para baixo", () => {
  // 0,37% de 95.000,00 = 351,50 → lance de 94.648,50
  assert.equal(rodar({ decremento: { tipo: "percentual", centesimos: 37 } }).valor, 94_648_50);
  // 0,33% de 1.000,01 = 3,300033 → passo de 3,30
  const d = rodar({ limite: 1_00, decremento: { tipo: "percentual", centesimos: 33 } }, { melhorLance: 1_000_01, meuUltimoLance: 1_100_00, lancesConcorrentes: [1_000_01] });
  assert.equal(d.valor, 996_71);
  // Passo percentual que daria zero centavo vira o passo mínimo da disputa.
  assert.equal(rodar({ limite: 1, decremento: { tipo: "percentual", centesimos: 1 } }, { melhorLance: 50, meuUltimoLance: 60, lancesConcorrentes: [50] }).valor, 49);
});

test("cobrir e ficar em 1º aguardam quando já se tem o melhor lance", () => {
  const primeiro = { minhaPosicao: 1, meuUltimoLance: 95_000_00, lancesConcorrentes: [96_000_00] };
  for (const estrategia of ["cobrir", "primeiro"]) {
    const d = rodar({ estrategia }, primeiro);
    assert.deepEqual([d.acao, d.regra, d.valor], ["aguardar", "ja_na_posicao", null], estrategia);
  }
});

test("ficar em 1º usa o menor passo que a disputa aceita", () => {
  assert.equal(rodar({ estrategia: "primeiro" }).valor, 94_999_99);
  assert.equal(rodar({ estrategia: "primeiro" }, {}, {}, { diferencaMelhor: 10_00 }).valor, 94_990_00);
});

test("posição alvo: supera só quem ocupa a posição desejada", () => {
  const terceiro = { minhaPosicao: 4, meuUltimoLance: 100_000_00 };
  // Alvo 2º: precisa ficar à frente do 2º concorrente (97.000,00), sem alcançar o 1º.
  const d = rodar({ estrategia: "posicao_alvo", posicaoAlvo: 2 }, terceiro);
  assert.deepEqual([d.acao, d.valor, d.regra], ["lancar", 96_999_99, "posicao_alvo"]);
  assert.equal(rodar({ estrategia: "posicao_alvo", posicaoAlvo: 3 }, terceiro).valor, 98_999_99);
  assert.equal(rodar({ estrategia: "posicao_alvo", posicaoAlvo: 1 }, terceiro).valor, 94_999_99);
  // Já dentro do alvo: aguarda.
  assert.equal(rodar({ estrategia: "posicao_alvo", posicaoAlvo: 2 }).regra, "ja_na_posicao");
  // Concorrentes de menos: sem referência.
  assert.equal(rodar({ estrategia: "posicao_alvo", posicaoAlvo: 5 }, { ...terceiro, minhaPosicao: null }).regra, "sem_espaco");
  // 1º e 2º colados: não cabe lance entre eles.
  const colado = rodar({ estrategia: "posicao_alvo", posicaoAlvo: 2 }, { ...terceiro, lancesConcorrentes: [95_000_00, 95_000_01, 99_000_00] });
  assert.deepEqual([colado.acao, colado.regra], ["aguardar", "sem_espaco"]);
  // A lista de concorrentes pode vir fora de ordem.
  assert.equal(rodar({ estrategia: "posicao_alvo", posicaoAlvo: 2 }, { ...terceiro, lancesConcorrentes: [99_000_00, 95_000_00, 97_000_00] }).valor, 96_999_99);
});

test("últimos segundos: só lança dentro da janela antes do fim previsto", () => {
  const c = { estrategia: "ultimos_segundos", ultimosSegundos: 30 };
  const fora = rodar(c, { agoraMs: 569_999 });
  assert.deepEqual([fora.acao, fora.regra], ["aguardar", "fora_da_janela"]);
  const dentro = rodar(c, { agoraMs: 570_000 });
  assert.deepEqual([dentro.acao, dentro.valor, dentro.regra], ["lancar", 94_950_00, "ultimos_segundos"]);
  // Prorrogação empurra o fim: volta a aguardar.
  assert.equal(rodar(c, { agoraMs: 570_000, fase: "prorrogacao", encerraEmMs: 690_000 }).regra, "fora_da_janela");
  // Sem fim previsto não há como aplicar a estratégia.
  assert.deepEqual([rodar(c, { encerraEmMs: null }).acao, rodar(c, { encerraEmMs: null }).regra], ["parar", "estado_inconsistente"]);
});

test("aberto-fechado: um único lance final, só na fase fechada", () => {
  const c = { estrategia: "lance_final", lanceFinal: 90_000_00 };
  assert.deepEqual([rodar(c).acao, rodar(c).regra], ["aguardar", "aguardar_fase"]);
  const fechada = { fase: "fechada" };
  const d = rodar(c, fechada);
  assert.deepEqual([d.acao, d.valor, d.regra], ["lancar", 90_000_00, "lance_final"]);
  // Depois de enviado, para (nunca repete).
  const memoria = registrarPasso(memoriaInicial(), estado(fechada), d, "aceito");
  assert.equal(memoria.lanceFinalEnviado, true);
  assert.equal(rodar(c, fechada, memoria).acao, "parar");
  // Lance final que não melhora o próprio lance não é enviado.
  assert.equal(rodar(c, { ...fechada, meuUltimoLance: 90_000_00 }).acao, "parar");
  assert.equal(rodar(c, { ...fechada, meuUltimoLance: 89_000_00, melhorLance: 89_000_00, minhaPosicao: 1 }).acao, "parar");
  // Lance final no piso exato é aceito; na fase fechada o melhor lance pode estar oculto.
  assert.equal(rodar({ ...c, lanceFinal: 80_000_00 }, { ...fechada, melhorLance: null, instanteMelhorLanceMs: null }).valor, 80_000_00);
  // Outras estratégias não lançam na fase fechada.
  assert.deepEqual([rodar({}, fechada).acao, rodar({}, fechada).regra], ["aguardar", "aguardar_fase"]);
});

// ---------- piso ----------

test("piso: nunca abaixo; no piso exato lança; depois para", () => {
  // Candidato cairia abaixo do piso → lança o piso exato, que ainda cobre o melhor.
  const noPiso = rodar({ limite: 94_980_00 });
  assert.deepEqual([noPiso.acao, noPiso.valor, noPiso.regra], ["lancar", 94_980_00, "piso_exato"]);
  // Candidato exatamente igual ao piso é lance normal.
  assert.deepEqual([rodar({ limite: 94_950_00 }).valor, rodar({ limite: 94_950_00 }).regra], [94_950_00, "cobrir"]);
  // Piso a um centavo do melhor: ainda cobre.
  assert.equal(rodar({ limite: 94_999_99 }).valor, 94_999_99);
  // Piso igual ao melhor lance: não há como cobrir → parar.
  const parado = rodar({ limite: 95_000_00 });
  assert.deepEqual([parado.acao, parado.regra, parado.valor], ["parar", "piso_atingido", null]);
  // Já lancei o piso e fui coberto → parar.
  assert.equal(rodar({ limite: 96_000_00 }).regra, "piso_atingido");
  // Diferença mínima da disputa maior que a folga até o piso → parar.
  assert.equal(rodar({ limite: 94_999_00 }, {}, {}, { diferencaMelhor: 5_00 }).regra, "piso_atingido");
});

// ---------- intervalos, diferenças e limites ----------

test("respeita o intervalo mínimo entre lances próprios", () => {
  const cedo = rodar({}, { instanteMeuUltimoLanceMs: 280_001 });
  assert.deepEqual([cedo.acao, cedo.regra], ["aguardar", "intervalo_proprio"]);
  assert.equal(rodar({}, { instanteMeuUltimoLanceMs: 280_000 }).acao, "lancar");
  // Vale também o que o próprio robô lembra ter enviado, mesmo que o estado ainda não mostre.
  assert.equal(rodar({}, {}, { instantesLances: [290_000] }).regra, "intervalo_proprio");
  assert.equal(rodar({}, { instanteMeuUltimoLanceMs: 299_000 }, {}, { intervaloProprioMs: 1_000 }).acao, "lancar");
});

test("respeita o intervalo mínimo em relação ao melhor lance", () => {
  const cedo = rodar({}, { instanteMelhorLanceMs: 297_001 });
  assert.deepEqual([cedo.acao, cedo.regra], ["aguardar", "intervalo_melhor"]);
  assert.equal(rodar({}, { instanteMelhorLanceMs: 297_000 }).acao, "lancar");
  // Lance intermediário (posição alvo, sem cobrir o melhor) não depende desse intervalo.
  const d = rodar({ estrategia: "posicao_alvo", posicaoAlvo: 2 }, { minhaPosicao: 4, meuUltimoLance: 100_000_00, instanteMelhorLanceMs: 299_999 });
  assert.equal(d.acao, "lancar");
});

test("respeita a diferença mínima em relação ao melhor lance e ao próprio lance", () => {
  // Decremento menor que a diferença mínima da disputa: usa a diferença mínima.
  assert.equal(rodar({ decremento: { tipo: "fixo", valor: 1 } }, {}, {}, { diferencaMelhor: 25_00 }).valor, 94_975_00);
  // Diferença em relação ao próprio lance: 96.000 − 2.000 = 94.000, mais baixo que 94.950.
  assert.equal(rodar({}, {}, {}, { diferencaPropria: 2_000_00 }).valor, 94_000_00);
  // Posição alvo: o lance precisa baixar o próprio em pelo menos a diferença própria.
  const d = rodar({ estrategia: "posicao_alvo", posicaoAlvo: 2 }, { minhaPosicao: 3, meuUltimoLance: 97_000_50 }, {}, { diferencaPropria: 10_00 });
  assert.equal(d.valor, 96_990_50);
});

test("limite de variação máxima por lance", () => {
  // Concorrente derrubou o preço em 40%: cobrir exigiria variar ~40,6% de uma vez → não lança.
  const queda = { melhorLance: 57_000_00, lancesConcorrentes: [57_000_00, 97_000_00] };
  const d = rodar({ limite: 10_000_00, descontoMaximoPorLance: 500 }, queda);
  assert.deepEqual([d.acao, d.regra, d.valor], ["aguardar", "limite_desconto_por_lance", null]);
  // Sem o limite, lançaria.
  assert.equal(rodar({ limite: 10_000_00 }, queda).valor, 56_950_00);
  // Limite que não atrapalha: 96.000 → 94.950 é 1,09%.
  assert.equal(rodar({ descontoMaximoPorLance: 110 }).valor, 94_950_00);
  // Decremento grande é contido no limite quando o valor contido ainda cobre o melhor: 96.000 − 2% = 94.080.
  const contido = rodar({ decremento: { tipo: "fixo", valor: 5_000_00 }, descontoMaximoPorLance: 200 });
  assert.equal(contido.valor, 94_080_00);
  assert.match(contido.motivo, /limite de variação/);
});

test("limite de lances por minuto", () => {
  const m = { instantesLances: [245_000, 255_000, 270_000] };
  const d = rodar({ maxLancesPorMinuto: 3 }, {}, m);
  assert.deepEqual([d.acao, d.regra], ["aguardar", "limite_por_minuto"]);
  assert.equal(rodar({ maxLancesPorMinuto: 4 }, {}, m).acao, "lancar");
  // Lances de mais de um minuto atrás não contam.
  assert.equal(rodar({ maxLancesPorMinuto: 3 }, {}, { instantesLances: [240_000, 255_000, 270_000] }).acao, "lancar");
});

// ---------- maior desconto ----------

test("critério maior desconto: sobe o desconto e respeita o desconto máximo", () => {
  const c = { criterio: "maior_desconto", limite: 2500, decremento: { tipo: "fixo", valor: 50 } };
  const e = { melhorLance: 1800, meuUltimoLance: 1700, lancesConcorrentes: [1800, 1500] };
  const d = rodar(c, e);
  assert.deepEqual([d.acao, d.valor], ["lancar", 1850]);
  assert.match(d.motivo, /18,50%/);
  // Passo percentual vale em pontos percentuais.
  assert.equal(rodar({ ...c, decremento: { tipo: "percentual", centesimos: 25 } }, e).valor, 1825);
  // Teto: lança o desconto máximo exato, nunca acima.
  const teto = rodar({ ...c, limite: 1820 }, e);
  assert.deepEqual([teto.valor, teto.regra], [1820, "piso_exato"]);
  assert.equal(rodar({ ...c, limite: 1800 }, e).regra, "piso_atingido");
  // Melhor = maior desconto: quem tem 18% está à frente de quem tem 17%.
  assert.equal(rodar(c, { ...e, meuUltimoLance: 1900 }).regra, "estado_inconsistente");
  assert.equal(rodar({ ...c, estrategia: "posicao_alvo", posicaoAlvo: 2 }, { ...e, meuUltimoLance: 1000, minhaPosicao: 3 }).valor, 1501);
  // Limite por lance em pontos: de 17% só pode ir até 17,80%.
  assert.equal(rodar({ ...c, descontoMaximoPorLance: 80 }, e).regra, "limite_desconto_por_lance");
});

// ---------- ME/EPP ----------

test("ME/EPP: empate ficto é só um aviso, até 5% acima do melhor", () => {
  const com = rodar({ meEpp: true }, { meuUltimoLance: 99_750_00 }); // exatamente 5% acima de 95.000
  assert.match(com.empateFicto, /empate ficto/);
  assert.equal(rodar({ meEpp: true }, { meuUltimoLance: 99_750_01 }).empateFicto, null);
  assert.equal(rodar({ meEpp: false }, { meuUltimoLance: 99_750_00 }).empateFicto, null);
  assert.equal(rodar({ meEpp: true }, { minhaPosicao: 1, meuUltimoLance: 95_000_00 }).empateFicto, null);
  // O aviso não muda a decisão.
  const sem = rodar({ meEpp: false }, { meuUltimoLance: 99_750_00 });
  assert.deepEqual([com.acao, com.valor, com.regra], [sem.acao, sem.valor, sem.regra]);
  // Aparece também quando o robô já parou (ex.: disputa encerrada).
  const fim = rodar({ meEpp: true }, { fase: "encerrada" });
  assert.equal(fim.acao, "parar");
  assert.match(fim.empateFicto, /empate ficto/);
});

// ---------- parada de emergência ----------

test("parada de emergência geral e por item vencem qualquer outra regra", () => {
  const geral = rodar({}, {}, {}, {}, { paradaGlobal: true });
  assert.deepEqual([geral.acao, geral.regra, geral.valor], ["parar", "parada_emergencia_global", null]);
  const item = rodar({ parada: true });
  assert.deepEqual([item.acao, item.regra], ["parar", "parada_emergencia_item"]);
  // Mesmo com configuração inválida, estado quebrado ou na fase fechada com lance final pronto.
  assert.equal(rodar({ limite: null }, { melhorLance: null }, {}, {}, { paradaGlobal: true }).regra, "parada_emergencia_global");
  assert.equal(rodar({ estrategia: "lance_final", lanceFinal: 90_000_00 }, { fase: "fechada" }, {}, {}, { paradaGlobal: true }).acao, "parar");
  assert.equal(rodar({ estrategia: "lance_final", lanceFinal: 90_000_00, parada: true }, { fase: "fechada" }).acao, "parar");
});

// ---------- paradas automáticas ----------

test("para quando a disputa encerra ou é suspensa", () => {
  assert.deepEqual([rodar({}, { fase: "encerrada" }).acao, rodar({}, { fase: "encerrada" }).regra], ["parar", "disputa_encerrada"]);
  assert.deepEqual([rodar({}, { fase: "suspensa" }).acao, rodar({}, { fase: "suspensa" }).regra], ["parar", "disputa_suspensa"]);
});

test("para em estado inconsistente", () => {
  const casos = {
    "melhor lance ausente": [{ melhorLance: null }, {}],
    "relógio retrocedeu": [{ agoraMs: 299_999 }, { ultimoAgoraMs: 300_000 }],
    "relógio inválido": [{ agoraMs: Number.NaN }, {}],
    "relógio negativo": [{ agoraMs: -1 }, {}],
    "fase desconhecida": [{ fase: "pausa" }, {}],
    "melhor lance zero": [{ melhorLance: 0 }, {}],
    "melhor lance fracionado": [{ melhorLance: 95_000.5 }, {}],
    "melhor lance texto": [{ melhorLance: "9500000" }, {}],
    "meu lance melhor que o melhor": [{ meuUltimoLance: 94_000_00 }, {}],
    "1º sem ser o melhor": [{ minhaPosicao: 1 }, {}],
    "posição zero": [{ minhaPosicao: 0 }, {}],
    "lance no futuro": [{ instanteMelhorLanceMs: 300_001 }, {}],
    "concorrente inválido": [{ lancesConcorrentes: [95_000_00, -3] }, {}],
    "concorrentes não é lista": [{ lancesConcorrentes: null }, {}],
  };
  for (const [nome, [e, m]] of Object.entries(casos)) {
    const d = rodar({}, e, m);
    assert.deepEqual([d.acao, d.regra, d.valor], ["parar", "estado_inconsistente", null], nome);
    assert.match(d.motivo, /Estado inconsistente/, nome);
  }
  // Relógio parado (mesmo instante) não é retrocesso.
  assert.equal(rodar({}, {}, { ultimoAgoraMs: 300_000 }).acao, "lancar");
});

test("para depois de N erros seguidos do conector", () => {
  let memoria = memoriaInicial();
  const c = config({ maxErrosSeguidos: 3 });
  const acoes = [];
  for (let i = 0; i < 3; i++) {
    const r = registrarErroDoConector(c, memoria, "tempo esgotado");
    memoria = r.memoria;
    acoes.push([r.registro.acao, r.registro.regra]);
  }
  assert.deepEqual(acoes, [["aguardar", "erro_do_conector"], ["aguardar", "erro_do_conector"], ["parar", "erros_do_conector"]]);
  assert.equal(rodar({}, {}, memoria).regra, "erros_do_conector");
  // Uma observação bem-sucedida zera a contagem.
  const depois = registrarPasso({ ...memoriaInicial(), errosSeguidos: 2 }, estado(), rodar({}, { minhaPosicao: 1, meuUltimoLance: 95_000_00 }), null);
  assert.equal(depois.errosSeguidos, 0);
  // Erro ao ENVIAR soma, e o envio conta para o intervalo (o lance pode ter chegado).
  const d = rodar();
  const comErro = registrarPasso({ ...memoriaInicial(), errosSeguidos: 1 }, estado(), d, "erro");
  assert.equal(comErro.errosSeguidos, 2);
  assert.deepEqual(comErro.instantesLances, [300_000]);
  assert.equal(rodar({}, { agoraMs: 301_000 }, comErro).regra, "intervalo_proprio");
});

test("a memória guarda só o último minuto de envios e nunca volta o relógio", () => {
  let memoria = memoriaInicial();
  const lance = rodar();
  for (const agoraMs of [100_000, 130_000, 170_000]) memoria = registrarPasso(memoria, estado({ agoraMs }), lance, "aceito");
  assert.deepEqual(memoria.instantesLances, [130_000, 170_000]);
  assert.equal(memoria.ultimoAgoraMs, 170_000);
  assert.equal(registrarPasso(memoria, estado({ agoraMs: 50 }), rodar({}, { minhaPosicao: 1, meuUltimoLance: 95_000_00 }), null).ultimoAgoraMs, 170_000);
});

// ---------- propriedade ----------

function gerador(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("propriedade: 30 mil estados aleatórios nunca furam piso, intervalos ou diferenças mínimas", () => {
  const r = gerador(20261112);
  const int = (min, max) => min + Math.floor(r() * (max - min + 1));
  const um = (lista) => lista[int(0, lista.length - 1)];
  const talvez = (p, v) => (r() < p ? null : v);
  const contagem = { lancar: 0, aguardar: 0, parar: 0 };

  for (let i = 0; i < 30_000; i++) {
    const desconto = r() < 0.3;
    const sinal = desconto ? -1 : 1;
    const valor = () => (desconto ? int(0, 6000) : int(1, r() < 0.5 ? 5_000 : 50_000_000));
    const estrategia = um(["cobrir", "primeiro", "posicao_alvo", "ultimos_segundos", "lance_final"]);
    const c = config({
      criterio: desconto ? "maior_desconto" : "menor_preco",
      limite: talvez(0.03, r() < 0.7 ? (desconto ? int(4000, 9000) : int(1, 3000)) : valor()),
      estrategia,
      decremento: r() < 0.5 ? { tipo: "fixo", valor: int(1, desconto ? 300 : 100_000) } : { tipo: "percentual", centesimos: int(1, 800) },
      posicaoAlvo: int(1, 4),
      ultimosSegundos: int(1, 120),
      lanceFinal: valor(),
      descontoMaximoPorLance: talvez(0.6, int(1, 3000)),
      maxLancesPorMinuto: int(1, 6),
      maxErrosSeguidos: int(1, 5),
      meEpp: r() < 0.5,
      parada: r() < 0.03,
    });
    const p = {
      intervaloProprioMs: int(0, 30_000),
      intervaloMelhorMs: int(0, 10_000),
      diferencaPropria: int(0, desconto ? 50 : 500),
      diferencaMelhor: int(0, desconto ? 50 : 500),
    };
    const agoraMs = int(0, 900_000);
    const concorrentes = Array.from({ length: int(0, 5) }, valor).sort((a, b) => sinal * (a - b));
    const meu = talvez(0.2, valor());
    // Na maioria dos casos o estado é coerente; no resto, vem bagunçado de propósito.
    const coerente = r() < 0.8;
    const todos = [...concorrentes, ...(meu == null ? [] : [meu])].sort((a, b) => sinal * (a - b));
    const melhor = coerente ? (todos[0] ?? null) : talvez(0.2, valor());
    const posicao = coerente ? (meu == null ? null : meu === melhor ? 1 : 1 + concorrentes.filter((v) => sinal * v <= sinal * meu).length) : talvez(0.3, int(0, 6));
    const e = {
      agoraMs,
      fase: um(["aberta", "aberta", "aberta", "aberta", "aberta", "prorrogacao", "prorrogacao", "fechada", "encerrada", "suspensa"]),
      encerraEmMs: talvez(0.05, agoraMs + int(-5_000, 200_000)),
      melhorLance: melhor,
      instanteMelhorLanceMs: talvez(0.1, agoraMs - int(coerente ? 0 : -100, 60_000)),
      meuUltimoLance: meu,
      instanteMeuUltimoLanceMs: meu == null ? null : talvez(0.1, agoraMs - int(0, 90_000)),
      minhaPosicao: posicao,
      lancesConcorrentes: concorrentes,
    };
    const m = {
      ultimoAgoraMs: talvez(0.3, agoraMs - int(coerente ? 0 : -2_000, 5_000)),
      instantesLances: Array.from({ length: int(0, 3) }, () => agoraMs - int(0, 150_000)).filter((t) => t >= 0),
      errosSeguidos: r() < 0.9 ? 0 : int(1, 6),
      lanceFinalEnviado: r() < 0.1,
    };
    const controle = { paradaGlobal: r() < 0.03 };
    const d = decidir(c, p, e, m, controle);
    contagem[d.acao]++;
    const contexto = () => JSON.stringify({ i, c, p, e, m, d });

    assert.equal(d.valor === null, d.acao !== "lancar", contexto());
    assert.ok(d.motivo.length > 0 && d.regra.length > 0, contexto());
    if (controle.paradaGlobal || c.parada || c.limite == null) assert.equal(d.acao, "parar", contexto());
    if (["encerrada", "suspensa"].includes(e.fase)) assert.notEqual(d.acao, "lancar", contexto());
    if (d.acao !== "lancar") continue;

    const v = d.valor;
    assert.ok(Number.isSafeInteger(v), contexto());
    // Nunca além do limite: abaixo do piso (menor preço) ou acima do desconto máximo.
    assert.ok(sinal * v >= sinal * c.limite, `furou o piso: ${contexto()}`);
    if (!desconto) assert.ok(v > 0, contexto());
    if (e.fase === "fechada") {
      assert.equal(v, c.lanceFinal, contexto());
      assert.equal(m.lanceFinalEnviado, false, contexto());
      continue;
    }
    // Diferença mínima em relação ao próprio lance.
    if (meu != null) assert.ok(sinal * (meu - v) >= Math.max(p.diferencaPropria, 1), `diferença própria: ${contexto()}`);
    // Diferença e intervalo mínimos ao cobrir o melhor lance.
    if (sinal * v < sinal * e.melhorLance) {
      assert.ok(sinal * (e.melhorLance - v) >= Math.max(p.diferencaMelhor, 1), `diferença do melhor: ${contexto()}`);
      if (e.instanteMelhorLanceMs != null) assert.ok(agoraMs - e.instanteMelhorLanceMs >= p.intervaloMelhorMs, `intervalo do melhor: ${contexto()}`);
    }
    // Intervalo entre lances próprios (pelo estado e pela memória do robô).
    for (const t of [e.instanteMeuUltimoLanceMs, ...m.instantesLances]) {
      if (t != null) assert.ok(agoraMs - t >= p.intervaloProprioMs, `intervalo próprio: ${contexto()}`);
    }
    // Limite por minuto e por lance.
    assert.ok(m.instantesLances.filter((t) => t > agoraMs - 60_000).length < c.maxLancesPorMinuto, `por minuto: ${contexto()}`);
    if (c.descontoMaximoPorLance != null) {
      const base = meu ?? e.melhorLance;
      const maximo = desconto ? c.descontoMaximoPorLance : fracao(base, c.descontoMaximoPorLance);
      assert.ok(sinal * (base - v) <= maximo, `variação por lance: ${contexto()}`);
    }
    assert.ok(m.errosSeguidos < c.maxErrosSeguidos, contexto());
  }
  // O gerador precisa exercitar de verdade os três desfechos.
  assert.ok(contagem.lancar > 1500 && contagem.aguardar > 500 && contagem.parar > 500, JSON.stringify(contagem));
});
