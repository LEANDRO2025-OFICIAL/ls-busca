// Licença e teste gratuito por organização: lógica pura de decisão (src/lib/licenca.ts) e a
// migração 0008 no Postgres embutido (PGlite), em pasta temporária fora do repositório.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { avaliarLicenca, ehEstadoLicenca, tempoRestante } from "../src/lib/licenca.ts";
import { abrirPglite, aplicarMigracoes, executorPglite } from "../src/lib/dados/migracoes.mjs";

const AGORA = new Date("2026-06-01T12:00:00Z");
const maisHoras = (h) => new Date(AGORA.getTime() + h * 3_600_000);

test("avaliação vigente libera; avaliação vencida bloqueia (nunca estende sozinha)", () => {
  const vigente = avaliarLicenca({ estado: "avaliacao", trialFim: maisHoras(10), licencaExpiraEm: null }, AGORA);
  assert.equal(vigente.liberado, true);
  assert.equal(vigente.situacao, "avaliacao");
  assert.equal(vigente.trialRestanteMs, 10 * 3_600_000);

  const vencida = avaliarLicenca({ estado: "avaliacao", trialFim: maisHoras(-1), licencaExpiraEm: null }, AGORA);
  assert.equal(vencida.liberado, false);
  assert.equal(vencida.situacao, "trial_encerrado");
  assert.match(vencida.motivo, /avalia/i);

  const semData = avaliarLicenca({ estado: "avaliacao", trialFim: null, licencaExpiraEm: null }, AGORA);
  assert.equal(semData.liberado, false);
});

test("licença ativa: sem validade libera sempre; com validade futura libera; vencida vira expirada", () => {
  const perpetua = avaliarLicenca({ estado: "ativa", trialFim: null, licencaExpiraEm: null }, AGORA);
  assert.equal(perpetua.liberado, true);
  assert.equal(perpetua.licencaRestanteMs, null);

  const futura = avaliarLicenca({ estado: "ativa", trialFim: null, licencaExpiraEm: maisHoras(48) }, AGORA);
  assert.equal(futura.liberado, true);
  assert.equal(futura.licencaRestanteMs, 48 * 3_600_000);

  const vencida = avaliarLicenca({ estado: "ativa", trialFim: null, licencaExpiraEm: maisHoras(-1) }, AGORA);
  assert.equal(vencida.liberado, false);
  assert.equal(vencida.situacao, "expirada");
});

test("estados expirada e bloqueada recusam", () => {
  assert.equal(avaliarLicenca({ estado: "expirada", trialFim: maisHoras(10), licencaExpiraEm: null }, AGORA).liberado, false);
  const b = avaliarLicenca({ estado: "bloqueada", trialFim: maisHoras(10), licencaExpiraEm: maisHoras(10) }, AGORA);
  assert.equal(b.liberado, false);
  assert.equal(b.situacao, "bloqueada");
});

test("ehEstadoLicenca e tempoRestante", () => {
  assert.equal(ehEstadoLicenca("ativa"), true);
  assert.equal(ehEstadoLicenca("qualquer"), false);
  assert.equal(tempoRestante(72 * 3_600_000), "3 dias");
  assert.equal(tempoRestante(26 * 3_600_000), "1 dia e 2 horas");
  assert.equal(tempoRestante(90 * 60_000), "1 hora e 30 minutos");
  assert.equal(tempoRestante(5 * 60_000), "5 minutos");
});

async function prepararBanco(t) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ls-busca-licenca-"));
  const db = await abrirPglite(path.join(raiz, "pglite"));
  t.after(async () => {
    await db.close();
    fs.rmSync(raiz, { recursive: true, force: true });
  });
  const aplicadas = await aplicarMigracoes(executorPglite(db));
  assert.ok(aplicadas.includes("0008_licenca.sql"));
  assert.deepEqual(await aplicarMigracoes(executorPglite(db)), []); // idempotente
  return db;
}

async function lerLicenca(db, id) {
  const r = await db.query("select licenca_estado, trial_fim, licenca_expira_em from organizacao where id = $1", [id]);
  const o = r.rows[0];
  return avaliarLicenca({ estado: o.licenca_estado, trialFim: new Date(o.trial_fim), licencaExpiraEm: o.licenca_expira_em ? new Date(o.licenca_expira_em) : null });
}

test("migração: nova organização começa em avaliação de ~72 h e fica liberada", async (t) => {
  const db = await prepararBanco(t);
  const id = (await db.query("insert into organizacao (nome) values ('Nova') returning id")).rows[0].id;
  const o = (await db.query("select licenca_estado, trial_inicio, trial_fim from organizacao where id = $1", [id])).rows[0];
  assert.equal(o.licenca_estado, "avaliacao");
  const horas = (new Date(o.trial_fim) - new Date(o.trial_inicio)) / 3_600_000;
  assert.ok(Math.abs(horas - 72) < 0.1, `72 h de teste, veio ${horas}`);
  assert.equal((await lerLicenca(db, id)).liberado, true);
});

test("migração: conta com trial no passado fica bloqueada; ativar libera", async (t) => {
  const db = await prepararBanco(t);
  const id = (await db.query("insert into organizacao (nome) values ('Velha') returning id")).rows[0].id;
  await db.query("update organizacao set trial_fim = now() - interval '1 hour' where id = $1", [id]);
  assert.equal((await lerLicenca(db, id)).liberado, false);

  // Ativar com validade futura (o que a tela do dono do sistema faz).
  await db.query("update organizacao set licenca_estado = 'ativa', licenca_expira_em = now() + interval '30 days' where id = $1", [id]);
  assert.equal((await lerLicenca(db, id)).liberado, true);

  // Bloquear recusa mesmo com trial/licença futuros.
  await db.query("update organizacao set licenca_estado = 'bloqueada' where id = $1", [id]);
  assert.equal((await lerLicenca(db, id)).liberado, false);
});

test("migração: o check recusa estado de licença inválido", async (t) => {
  const db = await prepararBanco(t);
  await assert.rejects(db.query("insert into organizacao (nome, licenca_estado) values ('X', 'inventado')"), /check/i);
});
