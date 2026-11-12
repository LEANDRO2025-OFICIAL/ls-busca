// Robô de lance: migração 0007 no Postgres embutido (PGlite), em pasta temporária fora do repositório.
// Confere restrições, isolamento por organização no esquema e a trilha de decisões só de acréscimo.
import assert from "node:assert/strict";
import { test } from "node:test";
import { abrirPglite, aplicarMigracoes, executorPglite } from "../src/lib/dados/migracoes.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function prepararBanco(t) {
  // Pasta FORA do repositório; fecha o banco antes de apagar a pasta.
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ls-busca-robo-"));
  const db = await abrirPglite(path.join(raiz, "pglite"));
  t.after(async () => {
    await db.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  });
  const aplicadas = await aplicarMigracoes(executorPglite(db));
  assert.ok(aplicadas.includes("0007_robo_lance.sql"));
  // Segunda passada não reaplica nada (idempotente).
  assert.deepEqual(await aplicarMigracoes(executorPglite(db)), []);
  await db.query("insert into modalidade (id, nome) values (6, 'Pregão - Eletrônico') on conflict do nothing");
  await db.query(`insert into licitacao (numero_controle_pncp, cnpj_orgao, ano, sequencial, objeto, modalidade_id, situacao_id,
                    situacao_nome, uf, orgao_nome, bruto)
                  values ('12345678000190-1-000001/2026', '12345678000190', 2026, 1, 'Aquisição de cimento', 6, 1, 'Divulgada', 'MS', 'Prefeitura', '{}')`);
  const org = async (nome) => {
    const o = (await db.query("insert into organizacao (nome) values ($1) returning id", [nome])).rows[0].id;
    const a = (await db.query(
      "insert into acompanhamento (organizacao_id, numero_controle_pncp) values ($1, '12345678000190-1-000001/2026') returning id",
      [o],
    )).rows[0].id;
    const c = (await db.query("insert into robo_config (organizacao_id, acompanhamento_id) values ($1, $2) returning id", [o, a])).rows[0].id;
    const i = (await db.query(
      `insert into robo_item (organizacao_id, robo_config_id, numero_item, descricao, valor_referencia, limite, estrategia, decremento_tipo, decremento_valor)
       values ($1, $2, 1, 'Cimento CP-II', 10000000, 8000000, 'cobrir', 'fixo', 5000) returning id`,
      [o, c],
    )).rows[0].id;
    return { o, a, c, i };
  };
  return { db, org };
}

async function simulacao(db, { o, c, i }) {
  const s = (await db.query(
    `insert into robo_simulacao (organizacao_id, robo_config_id, robo_item_id, descricao_item, config, cenario, resultado, linha_do_tempo, parou_por)
     values ($1, $2, $3, 'Cimento', '{}', '{}', '{"minhaPosicao": 1}', '[]', 'disputa_encerrada') returning id`,
    [o, c, i],
  )).rows[0].id;
  for (const [ordem, acao] of [[1, "aguardar"], [2, "lancar"], [3, "parar"]]) {
    await db.query(
      `insert into robo_decisao (organizacao_id, simulacao_id, ordem, instante_ms, ate_ms, acao, regra, valor, motivo)
       values ($1, $2, $3, $4, $4, $5, 'cobrir', $6, 'teste')`,
      [o, s, ordem, ordem * 1000, acao, acao === "lancar" ? 9_950_000 : null],
    );
  }
  return s;
}

test("restrições: piso obrigatório, estratégia conhecida, uma configuração por licitação e organização", async (t) => {
  const { db, org } = await prepararBanco(t);
  const a = await org("Empresa A");
  const inserirItem = (limite, estrategia = "cobrir", numero = 2) =>
    db.query(
      `insert into robo_item (organizacao_id, robo_config_id, numero_item, descricao, valor_referencia, limite, estrategia, decremento_tipo, decremento_valor)
       values ($1, $2, $3, 'x', 100, $4, $5, 'fixo', 1)`,
      [a.o, a.c, numero, limite, estrategia],
    );
  await assert.rejects(inserirItem(null), /not-null|null value/);
  await assert.rejects(inserirItem(-1), /check/);
  await assert.rejects(inserirItem(10, "inventada"), /check/);
  await assert.rejects(inserirItem(10, "cobrir", 1), /unique|duplicate/);
  await inserirItem(10);
  await assert.rejects(db.query("insert into robo_config (organizacao_id, acompanhamento_id) values ($1, $2)", [a.o, a.a]), /unique|duplicate/);
  // Padrões das regras da disputa: configuráveis, gravados na configuração.
  const p = (await db.query("select intervalo_proprio_ms, intervalo_melhor_ms, diferenca_propria, diferenca_melhor from robo_config where id = $1", [a.c])).rows[0];
  assert.deepEqual([p.intervalo_proprio_ms, p.intervalo_melhor_ms, Number(p.diferenca_propria), Number(p.diferenca_melhor)], [20000, 3000, 1, 1]);
});

test("trilha de decisões só aceita acréscimo", async (t) => {
  const { db, org } = await prepararBanco(t);
  const a = await org("Empresa A");
  const s = await simulacao(db, a);
  await assert.rejects(db.query("update robo_decisao set motivo = 'alterado' where simulacao_id = $1", [s]), /não pode ser alterada/);
  await assert.rejects(db.query("delete from robo_decisao where simulacao_id = $1", [s]), /não pode ser apagada/);
  // Ordem é única por simulação.
  await assert.rejects(db.query(
    "insert into robo_decisao (organizacao_id, simulacao_id, ordem, instante_ms, ate_ms, acao, regra, motivo) values ($1, $2, 1, 0, 0, 'aguardar', 'x', 'x')",
    [a.o, s],
  ), /unique|duplicate/);
});

test("apagar a simulação ou a organização leva a trilha junto; apagar a configuração mantém a simulação", async (t) => {
  const { db, org } = await prepararBanco(t);
  const a = await org("Empresa A");
  const b = await org("Empresa B");
  const sa = await simulacao(db, a);
  const sb = await simulacao(db, b);
  const contar = async (s) => Number((await db.query("select count(*) from robo_decisao where simulacao_id = $1", [s])).rows[0].count);
  assert.equal(await contar(sa), 3);

  // Configuração apagada: a simulação continua legível (cópia da configuração), sem o vínculo.
  await db.query("delete from robo_config where id = $1", [a.c]);
  const sim = (await db.query("select robo_config_id, robo_item_id from robo_simulacao where id = $1", [sa])).rows[0];
  assert.deepEqual([sim.robo_config_id, sim.robo_item_id], [null, null]);
  assert.equal(await contar(sa), 3);

  await db.query("delete from robo_simulacao where id = $1", [sa]);
  assert.equal(await contar(sa), 0);

  await db.query("delete from organizacao where id = $1", [b.o]);
  assert.equal(await contar(sb), 0);
  assert.equal(Number((await db.query("select count(*) from robo_item where organizacao_id = $1", [b.o])).rows[0].count), 0);
});

test("consultas filtradas por organização não enxergam dados de outra", async (t) => {
  const { db, org } = await prepararBanco(t);
  const a = await org("Empresa A");
  const b = await org("Empresa B");
  await simulacao(db, a);
  // Mesmo filtro usado em src/lib/dados/robo.ts: id da linha E organização de quem entrou.
  const item = await db.query("update robo_item set parada = true where id = $1 and organizacao_id = $2 returning id", [a.i, b.o]);
  assert.equal(item.rows.length, 0);
  assert.equal((await db.query("select parada from robo_item where id = $1", [a.i])).rows[0].parada, false);
  const sims = await db.query("select id from robo_simulacao where organizacao_id = $1", [b.o]);
  assert.equal(sims.rows.length, 0);
  // Parada geral: uma linha por organização.
  await db.query("insert into robo_parada (organizacao_id, ativa) values ($1, true)", [a.o]);
  await assert.rejects(db.query("insert into robo_parada (organizacao_id, ativa) values ($1, false)", [a.o]), /duplicate|unique|pkey/);
});
