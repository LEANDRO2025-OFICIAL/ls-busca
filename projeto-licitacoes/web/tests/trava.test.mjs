// Trava de exclusão do banco embutido. Tudo em pasta temporária fora do repositório.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "node:test";
import { ErroBancoEmUso, adquirirTrava, caminhoDaTrava, situacaoDaTrava } from "../src/lib/dados/trava-banco.mjs";
import { contarLinhas, pastaTemporaria, pidMorto, retrato, segurar } from "./auxiliar/comum.mjs";

const gravarTrava = (pasta, dono) =>
  fs.writeFileSync(caminhoDaTrava(pasta), JSON.stringify({ hostname: os.hostname(), inicio: new Date().toISOString(), ...dono }));

test("dois processos na mesma pasta: o segundo falha limpo e o banco segue íntegro", async (t) => {
  const { pasta } = pastaTemporaria(t);
  const a = segurar(pasta, "um", "dois");
  t.after(() => a.filho.kill("SIGKILL"));
  await a.pronto;
  assert.match(a.saida, /PRONTO 2/, a.erro);

  const trava = JSON.parse(fs.readFileSync(caminhoDaTrava(pasta), "utf8"));
  assert.equal(trava.pid, a.filho.pid);
  assert.equal(trava.hostname, os.hostname());
  assert.ok(Date.parse(trava.inicio) > 0);
  assert.ok("porta" in trava);

  const antes = retrato(pasta);
  const b = await segurar(pasta, "intruso").fim;
  assert.equal(b.codigo, 2, "o segundo processo deve recusar com código 2");
  assert.match(b.erro, new RegExp(`PID ${a.filho.pid}`), "a mensagem diz quem segura o banco");
  assert.doesNotMatch(b.saida, /PRONTO/);
  assert.equal(retrato(pasta), antes, "o segundo processo não pode tocar na pasta de dados");
  assert.equal(JSON.parse(fs.readFileSync(caminhoDaTrava(pasta), "utf8")).pid, a.filho.pid, "a trava continua do primeiro");

  // Desligamento limpo por SIGTERM: fecha o PGlite e solta a trava.
  a.filho.kill("SIGTERM");
  await a.fim;
  assert.equal(a.codigo, 143);
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false, "a trava é solta no SIGTERM");
  assert.equal(await contarLinhas(pasta), 2, "os dados do primeiro seguem lá e o intruso não gravou");
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false, "a trava é solta na saída normal");
});

test("SIGINT (Ctrl+C) também fecha limpo e solta a trava", async (t) => {
  const { pasta } = pastaTemporaria(t);
  const a = segurar(pasta, "um");
  t.after(() => a.filho.kill("SIGKILL"));
  await a.pronto;
  a.filho.kill("SIGINT");
  await a.fim;
  assert.equal(a.codigo, 130);
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false);
});

test("trava órfã (PID morto) é assumida com aviso", async (t) => {
  const { pasta } = pastaTemporaria(t);
  fs.mkdirSync(pasta, { recursive: true });
  const morto = await pidMorto();
  gravarTrava(pasta, { pid: morto, porta: 3000 });
  assert.equal(situacaoDaTrava(pasta).estado, "orfa");

  const avisos = [];
  const trava = adquirirTrava(pasta, { rotulo: "teste", aviso: (m) => avisos.push(m) });
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /órfã/);
  assert.match(avisos[0], new RegExp(`PID ${morto}`));
  assert.equal(JSON.parse(fs.readFileSync(trava.arquivo, "utf8")).pid, process.pid);
  trava.soltar();
  assert.equal(fs.existsSync(trava.arquivo), false);
});

test("trava de processo vivo (ou de outra máquina) é recusada sem ser alterada", async (t) => {
  const { pasta } = pastaTemporaria(t);
  fs.mkdirSync(pasta, { recursive: true });
  for (const dono of [{ pid: process.ppid, porta: 3000 }, { pid: 1, hostname: "outra-maquina" }]) {
    gravarTrava(pasta, dono);
    const conteudo = fs.readFileSync(caminhoDaTrava(pasta), "utf8");
    assert.throws(() => adquirirTrava(pasta, { aviso: () => {} }), (erro) => erro instanceof ErroBancoEmUso && erro.dono.pid === dono.pid);
    assert.equal(fs.readFileSync(caminhoDaTrava(pasta), "utf8"), conteudo);
    assert.equal(fs.existsSync(`${pasta}/PG_VERSION`), false, "a pasta de dados não é aberta");
  }
});

test("kill -9 seguido de reabertura: a trava órfã é recuperada e os dados estão lá", async (t) => {
  const { pasta } = pastaTemporaria(t);
  const a = segurar(pasta, "um", "dois", "três");
  t.after(() => a.filho.kill("SIGKILL"));
  await a.pronto;
  a.filho.kill("SIGKILL");
  await a.fim;
  assert.equal(a.sinal, "SIGKILL");
  assert.equal(JSON.parse(fs.readFileSync(caminhoDaTrava(pasta), "utf8")).pid, a.filho.pid, "a trava fica para trás");

  const b = await segurar(pasta, "quatro", "--sair").fim;
  assert.equal(b.codigo, 0, b.erro);
  assert.match(b.erro, /órfã/, "avisa que assumiu a trava órfã");
  assert.match(b.saida, /PRONTO 4/);
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false);
  assert.equal(await contarLinhas(pasta), 4);
});

test("vários processos disputando uma trava órfã: exatamente um vence", async (t) => {
  const { pasta } = pastaTemporaria(t);
  fs.mkdirSync(pasta, { recursive: true });
  gravarTrava(pasta, { pid: await pidMorto() });
  const todos = await Promise.all(Array.from({ length: 6 }, () => segurar(pasta, "--so-trava").fim));
  const codigos = todos.map((r) => r.codigo).sort();
  assert.deepEqual(codigos, [0, 2, 2, 2, 2, 2], todos.map((r) => r.erro).join("\n"));
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false);
});
