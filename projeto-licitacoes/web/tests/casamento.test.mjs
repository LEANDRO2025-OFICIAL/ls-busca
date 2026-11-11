// Alertas e comunidade: casamento alerta × licitação e corpo do webhook (lógica pura de src/lib/casamento.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { casar, lerLimiteComunidade, lerTermos, montarCorpoWebhook, normalizar } from "../src/lib/casamento.ts";

const criterio = (c = {}) => ({
  termos: [],
  excluidos: [],
  uf: null,
  municipio: null,
  modalidade: null,
  valorMinCentavos: null,
  valorMaxCentavos: null,
  ...c,
});
const licitacao = (l = {}) => ({
  objeto: "Aquisição de cimento e areia para obras",
  orgao: "Prefeitura Municipal de Dourados",
  complemento: null,
  uf: "MS",
  municipio: "Dourados",
  modalidadeId: 6,
  valorCentavos: 1_500_000_00,
  ...l,
});

test("normaliza acentos, caixa e pontuação", () => {
  assert.equal(normalizar("  Construção-Civil; ÁGUA "), "construcao civil agua");
});

test("lê termos, frases entre aspas e exclusões", () => {
  assert.deepEqual(lerTermos('cimento -asfalto "material de construção" OR Cimento'), {
    termos: ["cimento", "material de construcao"],
    excluidos: ["asfalto"],
  });
  assert.deepEqual(lerTermos("   "), { termos: [], excluidos: [] });
});

test("termos: todos precisam aparecer, no começo de palavra, sem acento", () => {
  assert.equal(casar(criterio({ termos: ["cimento"] }), licitacao()).casa, true);
  assert.equal(casar(criterio({ termos: ["aquisicao", "obras"] }), licitacao()).casa, true);
  assert.equal(casar(criterio({ termos: ["cimento", "asfalto"] }), licitacao()).casa, false);
  // "cimento" não pode casar com "fornecimento".
  assert.equal(casar(criterio({ termos: ["cimento"] }), licitacao({ objeto: "Fornecimento de água" })).casa, false);
  // Casa também pelo órgão e pela informação complementar.
  assert.equal(casar(criterio({ termos: ["dourados"] }), licitacao()).casa, true);
  assert.equal(casar(criterio({ termos: ["brita"] }), licitacao({ complemento: "Inclui brita nº 1" })).casa, true);
});

test("excluídos e termos do ramo (algumDe)", () => {
  assert.equal(casar(criterio({ termos: ["cimento"], excluidos: ["areia"] }), licitacao()).casa, false);
  assert.equal(casar(criterio({ algumDe: ["tijolo", "areia"] }), licitacao()).casa, true);
  assert.equal(casar(criterio({ algumDe: ["tijolo"] }), licitacao()).casa, false);
});

test("UF, município e modalidade", () => {
  assert.equal(casar(criterio({ uf: "ms" }), licitacao()).casa, true);
  assert.equal(casar(criterio({ uf: "SP" }), licitacao()).casa, false);
  assert.equal(casar(criterio({ municipio: "DOURADOS" }), licitacao()).casa, true);
  assert.equal(casar(criterio({ municipio: "São Paulo" }), licitacao({ municipio: "Sao Paulo" })).casa, true);
  assert.equal(casar(criterio({ municipio: "Dourados" }), licitacao({ municipio: null })).casa, false);
  assert.equal(casar(criterio({ modalidade: 6 }), licitacao()).casa, true);
  assert.equal(casar(criterio({ modalidade: 8 }), licitacao()).casa, false);
});

test("faixa de valor: limites inclusivos; sem valor estimado não casa com faixa", () => {
  const v = 1_500_000_00;
  assert.equal(casar(criterio({ valorMinCentavos: v }), licitacao()).casa, true);
  assert.equal(casar(criterio({ valorMinCentavos: v + 1 }), licitacao()).casa, false);
  assert.equal(casar(criterio({ valorMaxCentavos: v }), licitacao()).casa, true);
  assert.equal(casar(criterio({ valorMaxCentavos: v - 1 }), licitacao()).casa, false);
  assert.equal(casar(criterio({ valorMinCentavos: 1 }), licitacao({ valorCentavos: null })).casa, false);
  assert.equal(casar(criterio({ valorMaxCentavos: 1 }), licitacao({ valorCentavos: null })).casa, false);
  assert.equal(casar(criterio(), licitacao({ valorCentavos: null })).casa, true);
});

test("o motivo explica por que casou", () => {
  const r = casar(criterio({ termos: ["cimento"], uf: "MS", valorMinCentavos: 100_000_00 }), licitacao());
  assert.equal(r.casa, true);
  assert.match(r.motivo, /contém “cimento”/);
  assert.match(r.motivo, /UF MS/);
  assert.match(r.motivo, /valor a partir de/);
  const semFiltro = casar(criterio(), licitacao());
  assert.equal(semFiltro.casa && semFiltro.motivo, "licitação nova");
});

test("limite da comunidade: padrão de R$ 10 milhões e leitura da variável", () => {
  assert.equal(lerLimiteComunidade(undefined), 10_000_000_00);
  assert.equal(lerLimiteComunidade(""), 10_000_000_00);
  assert.equal(lerLimiteComunidade("0"), 10_000_000_00);
  assert.equal(lerLimiteComunidade("5000000"), 5_000_000_00);
  assert.equal(lerLimiteComunidade("R$ 2.500.000"), 2_500_000_00);
});

test("corpo do webhook: formato documentado no README", () => {
  const corpo = montarCorpoWebhook(
    [
      {
        id: "a1",
        criadoEm: new Date("2026-11-10T12:00:00Z"),
        motivo: "contém “cimento”",
        alerta: { id: "b1", nome: "Cimento em MS", tipo: "busca" },
        licitacao: {
          numeroControle: "00000000000191-1-000001/2026",
          objeto: "Aquisição de cimento",
          orgao: "Prefeitura",
          uf: "MS",
          municipio: null,
          modalidade: "Pregão - Eletrônico",
          valorCentavos: 123_456_78,
          encerramento: null,
          cnpj: "00000000000191",
          ano: 2026,
          sequencial: 1,
        },
      },
    ],
    new Date("2026-11-10T12:05:00Z"),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(corpo)), {
    evento: "avisos.novos",
    enviadoEm: "2026-11-10T12:05:00.000Z",
    avisos: [
      {
        id: "a1",
        criadoEm: "2026-11-10T12:00:00.000Z",
        motivo: "contém “cimento”",
        alerta: { id: "b1", nome: "Cimento em MS", tipo: "busca" },
        licitacao: {
          numeroControle: "00000000000191-1-000001/2026",
          objeto: "Aquisição de cimento",
          orgao: "Prefeitura",
          uf: "MS",
          municipio: null,
          modalidade: "Pregão - Eletrônico",
          valorEstimado: 123456.78,
          encerramento: null,
          caminho: "/licitacao/00000000000191/2026/1",
        },
      },
    ],
  });
});
