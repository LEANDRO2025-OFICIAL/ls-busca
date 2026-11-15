// Funil: agrupamento das etapas nas 6 fases e taxa de conversão (lógica pura de src/lib/etapas.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { ETAPAS, ETAPAS_ENCERRADAS, FASES, faseDaEtapa, indiceDaFase, resumirFases } from "../src/lib/etapas.ts";

test("toda etapa pertence a exatamente uma fase ou está encerrada", () => {
  for (const etapa of ETAPAS) {
    const fases = FASES.filter((f) => f.etapas.includes(etapa));
    assert.equal(fases.length + (ETAPAS_ENCERRADAS.includes(etapa) ? 1 : 0), 1, etapa);
  }
  assert.deepEqual(FASES.map((f) => f.nome), ["Descoberta", "Análise", "Interesse", "Proposta", "Homologação", "Contrato"]);
  assert.equal(faseDaEtapa("em_disputa"), "proposta");
  assert.equal(faseDaEtapa("ganhou"), "homologacao");
  assert.equal(faseDaEtapa("contrato"), "contrato");
  assert.equal(faseDaEtapa("perdeu"), null);
  assert.equal(indiceDaFase("inexistente"), -1);
});

test("resumo conta, soma valores e calcula a conversão entre fases", () => {
  const r = resumirFases([
    { etapa: "interesse", valorCentavos: 100 },
    { etapa: "analise", valorCentavos: 200 },
    { etapa: "sessao_hoje", valorCentavos: null },
    { etapa: "em_disputa", valorCentavos: 300 },
    { etapa: "contrato", valorCentavos: 1000 },
    // Perdeu depois de enviar proposta: conta como tendo chegado à Proposta.
    { etapa: "perdeu", valorCentavos: 50, historico: ["interesse", "analise", "proposta_enviada", "perdeu"] },
    // Desistiu sem histórico: só a Descoberta.
    { etapa: "desistiu", valorCentavos: 70 },
  ]);
  assert.equal(r.total, 7);
  assert.equal(r.encerradas, 2);
  assert.deepEqual(r.fases.map((f) => f.quantidade), [1, 1, 0, 2, 0, 1]);
  assert.deepEqual(r.fases.map((f) => f.valorCentavos), [100, 200, 0, 300, 0, 1000]);
  assert.deepEqual(r.fases.map((f) => f.alcancaram), [7, 5, 4, 4, 1, 1]);
  assert.equal(r.fases[0].conversao, 5 / 7);
  assert.equal(r.fases[3].conversao, 1 / 4);
  assert.equal(r.fases[4].conversao, 1);
  assert.equal(r.fases[5].conversao, null);
});

test("funil vazio não divide por zero", () => {
  const r = resumirFases([]);
  assert.equal(r.total, 0);
  assert.ok(r.fases.every((f) => f.conversao === null && f.quantidade === 0));
});
