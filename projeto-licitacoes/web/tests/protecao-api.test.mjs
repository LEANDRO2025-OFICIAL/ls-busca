// Proteção das rotas de dados: status de autorização (sem sessão/sem licença) e o limitador em
// memória (lógica pura de src/lib/protecao-api.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { limparBaldes, permitir, statusDeAutorizacao } from "../src/lib/protecao-api.ts";

test("rota de dados: sem sessão → 401; sem licença → 403; com os dois → segue", () => {
  assert.equal(statusDeAutorizacao(false, false), 401);
  assert.equal(statusDeAutorizacao(false, true), 401); // sem sessão vence
  assert.equal(statusDeAutorizacao(true, false), 403);
  assert.equal(statusDeAutorizacao(true, true), null);
});

test("limitador: deixa passar até o limite e barra o excedente na janela", () => {
  limparBaldes();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) {
    const r = permitir("cliente-a", 3, 10_000, t0 + i);
    assert.equal(r.ok, true, `chamada ${i + 1} deveria passar`);
  }
  const estourou = permitir("cliente-a", 3, 10_000, t0 + 5);
  assert.equal(estourou.ok, false);
  assert.equal(estourou.restantes, 0);
});

test("limitador: janela reinicia depois do tempo e chaves são independentes", () => {
  limparBaldes();
  const t0 = 2_000_000;
  assert.equal(permitir("a", 1, 1000, t0).ok, true);
  assert.equal(permitir("a", 1, 1000, t0 + 100).ok, false);
  // Outra chave não é afetada.
  assert.equal(permitir("b", 1, 1000, t0 + 100).ok, true);
  // Depois da janela, "a" volta a passar.
  assert.equal(permitir("a", 1, 1000, t0 + 1001).ok, true);
});
