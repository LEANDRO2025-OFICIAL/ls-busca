// Robô de lance: leitura do formulário de configuração (lógica pura de src/lib/robo/formulario.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { camposDoItem, configDoItem, lerFormularioRobo } from "../src/lib/robo/formulario.ts";

const formulario = (extra = {}, item = {}) => {
  const base = {
    numero: "1",
    descricao: "Cimento CP-II 50 kg",
    referencia: "100.000,00",
    limite: "80.000,00",
    estrategia: "cobrir",
    decrementoTipo: "fixo",
    decremento: "50,00",
    lancesPorMinuto: "6",
    errosSeguidos: "3",
    ...item,
  };
  return {
    criterio: "menor_preco",
    modo: "aberto",
    intervaloProprio: "20",
    intervaloMelhor: "3",
    diferencaPropria: "0,01",
    diferencaMelhor: "0,01",
    itens: "1",
    confirmacao: "sim",
    ...Object.fromEntries(Object.entries(base).map(([k, v]) => [`item-0-${k}`, v])),
    ...extra,
  };
};

test("lê o formulário em inteiros (centavos e milissegundos)", () => {
  const r = lerFormularioRobo(formulario());
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  const { entrada } = r;
  assert.deepEqual(entrada.parametros, { intervaloProprioMs: 20_000, intervaloMelhorMs: 3_000, diferencaPropria: 1, diferencaMelhor: 1 });
  assert.deepEqual(
    [entrada.itens[0].valorReferencia, entrada.itens[0].limite, entrada.itens[0].decrementoValor],
    [100_000_00, 80_000_00, 50_00],
  );
  // Ida e volta pelo formulário de edição.
  const volta = lerFormularioRobo(formulario({}, camposDoItem(entrada.itens[0])));
  assert.deepEqual(volta.entrada, entrada);
  assert.equal(lerFormularioRobo(formulario({ intervaloProprio: "1,5" })).entrada.parametros.intervaloProprioMs, 1_500);
});

test("piso obrigatório e confirmação explícita", () => {
  const semPiso = lerFormularioRobo(formulario({}, { limite: "" }));
  assert.equal(semPiso.ok, false);
  assert.match(semPiso.erros["item-0-limite"], /obrigatório/);
  const semConfirmar = lerFormularioRobo(formulario({ confirmacao: undefined }));
  assert.equal(semConfirmar.ok, false);
  assert.match(semConfirmar.erros.confirmacao, /Confirme/);
  assert.match(lerFormularioRobo(formulario({}, { limite: "0" })).erros["item-0-limite"], /maior que zero/);
});

test("aponta erros por campo", () => {
  const erros = (extra, item) => lerFormularioRobo(formulario(extra, item)).erros ?? {};
  assert.match(erros({}, { referencia: "70.000,00" })["item-0-referencia"], /abaixo do piso/);
  assert.match(erros({}, { decremento: "1,234" })["item-0-decremento"], /duas casas/);
  assert.match(erros({}, { estrategia: "lance_final", lanceFinal: "90.000,00" })["item-0-estrategia"], /aberto-fechado/);
  assert.match(erros({ modo: "aberto_fechado" }, { estrategia: "lance_final", lanceFinal: "70.000,00" })["item-0-lanceFinal"], /abaixo do valor mínimo/);
  assert.match(erros({}, { estrategia: "posicao_alvo" })["item-0-posicaoAlvo"], /posição alvo/);
  assert.match(erros({}, { estrategia: "ultimos_segundos", ultimosSegundos: "abc" })["item-0-ultimosSegundos"], /inteiro/);
  assert.match(erros({}, { lancesPorMinuto: "0" })["item-0-lancesPorMinuto"], /por minuto/);
  assert.match(erros({ itens: "0" }).itens, /pelo menos um/);
  assert.match(erros({ criterio: "outro" }).criterio, /critério/);
  assert.match(erros({ intervaloProprio: "-1" }).intervaloProprio, /segundos/);
  // Números de item repetidos.
  const dois = { ...formulario(), itens: "2", ...Object.fromEntries(Object.entries(formulario()).filter(([k]) => k.startsWith("item-0-")).map(([k, v]) => [k.replace("item-0-", "item-1-"), v])) };
  assert.match(lerFormularioRobo(dois).erros["item-1-numero"], /repetido/);
});

test("maior desconto: limite é o desconto máximo, em centésimos de %", () => {
  const r = lerFormularioRobo(formulario({ criterio: "maior_desconto" }, { referencia: "5%", limite: "22,5", decremento: "0,25" }));
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  const cfg = configDoItem("maior_desconto", r.entrada.itens[0]);
  assert.deepEqual([cfg.limite, cfg.decremento], [2250, { tipo: "fixo", valor: 25 }]);
  assert.match(lerFormularioRobo(formulario({ criterio: "maior_desconto" }, { referencia: "30", limite: "22,5" })).erros["item-0-referencia"], /desconto máximo/);
});

test("configDoItem só leva o campo da estratégia escolhida", () => {
  const r = lerFormularioRobo(formulario({}, { posicaoAlvo: "2", ultimosSegundos: "30" }));
  const cfg = configDoItem("menor_preco", r.entrada.itens[0]);
  assert.deepEqual([cfg.posicaoAlvo, cfg.ultimosSegundos, cfg.lanceFinal, cfg.parada], [null, null, null, false]);
});
