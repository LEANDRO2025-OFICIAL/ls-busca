// Scripts de linha de comando: recusam com o banco em uso; backup e restauração.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { copiarPastaFechada, gravarDump, listarBackups, pastaDeBackups } from "../src/lib/dados/backup-banco.mjs";
import { abrirPglite } from "../src/lib/dados/migracoes.mjs";
import { adquirirTrava, caminhoDaTrava } from "../src/lib/dados/trava-banco.mjs";
import { contarLinhas, pastaTemporaria, portaLivre, retrato, rodar, script, segurar } from "./auxiliar/comum.mjs";

/** Roda um script do projeto contra a pasta temporária, com portas que não colidem com um LS Busca real. */
async function rodarScript(nome, pasta, raiz, args = [], portas) {
  const env = { PGLITE_PASTA: pasta, LS_BUSCA_PORTAS: String(portas ?? (await portaLivre())) };
  return rodar([script(nome), ...args], { env, cwd: raiz }).fim;
}

function servidor(t, responder) {
  return new Promise((resolver) => {
    const s = http.createServer(responder).listen(0, "127.0.0.1", () => resolver(s.address().port));
    t.after(() => s.close());
  });
}

test("redefinir-senha recusa com a trava ativa, sem tocar no banco", async (t) => {
  const { raiz, pasta } = pastaTemporaria(t);
  const a = segurar(pasta, "um");
  t.after(() => a.filho.kill("SIGKILL"));
  await a.pronto;
  const antes = retrato(pasta);

  const r = await rodarScript("redefinir-senha.mjs", pasta, raiz);
  assert.equal(r.codigo, 2);
  assert.match(r.erro, new RegExp(`PID ${a.filho.pid}`));
  assert.match(r.erro, /Nada foi alterado/);
  assert.doesNotMatch(r.saida, /Contas cadastradas|Senha de/);
  assert.equal(retrato(pasta), antes);
  assert.equal(JSON.parse(fs.readFileSync(caminhoDaTrava(pasta), "utf8")).pid, a.filho.pid);
  assert.equal(fs.existsSync(pastaDeBackups(pasta)), false, "nem cópia de segurança é feita na recusa");
});

test("redefinir-senha recusa com o servidor respondendo na porta, mesmo sem trava", async (t) => {
  const { raiz, pasta } = pastaTemporaria(t);
  const porta = await servidor(t, (_, res) => res.end("ok"));
  const r = await rodarScript("redefinir-senha.mjs", pasta, raiz, [], porta);
  assert.equal(r.codigo, 2);
  assert.match(r.erro, new RegExp(`porta ${porta}`));
  assert.equal(fs.existsSync(pasta), false, "não cria a pasta de dados");
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false, "não deixa trava");
});

test("redefinir-senha sem banco: sai com erro, não cria banco e solta a trava", async (t) => {
  const { raiz, pasta } = pastaTemporaria(t);
  const r = await rodarScript("redefinir-senha.mjs", pasta, raiz);
  assert.equal(r.codigo, 1);
  assert.equal(fs.existsSync(path.join(pasta, "PG_VERSION")), false);
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false);
});

test("verificar-servidor: livre, LS Busca no ar, outro programa na porta, banco em uso", async (t) => {
  const { raiz, pasta } = pastaTemporaria(t);
  const verificar = (porta) => rodar([script("verificar-servidor.mjs"), String(porta)], { env: { PGLITE_PASTA: pasta }, cwd: raiz }).fim;

  assert.equal((await verificar(await portaLivre())).codigo, 0);
  assert.equal(fs.existsSync(pasta), false, "a verificação não cria nada");

  const lsBusca = await servidor(t, (req, res) => res.end(req.url === "/api/saude" ? '{"app":"ls-busca"}' : "x"));
  assert.equal((await verificar(lsBusca)).codigo, 10);

  const outro = await servidor(t, (_, res) => res.end("<html>outro sistema</html>"));
  assert.equal((await verificar(outro)).codigo, 11);

  const a = segurar(pasta, "--so-trava");
  await a.pronto;
  const r = await verificar(await portaLivre());
  assert.equal(r.codigo, 12);
  assert.match(r.saida, new RegExp(`PID ${a.filho.pid}`));
  await a.fim;
});

test("backup com o banco fechado, retenção e restauração", async (t) => {
  const { raiz, pasta } = pastaTemporaria(t);
  assert.equal(await contarLinhas(pasta), 0);
  await segurar(pasta, "um", "--sair").fim;

  const copia = await copiarPastaFechada(pasta, "teste", { retencao: 3 });
  assert.equal(copia.tipo, "pasta");
  assert.ok(fs.existsSync(path.join(copia.caminho, "PG_VERSION")));
  assert.match(copia.nome, /^pglite-\d{4}-\d{2}-\d{2}_\d{6}-teste$/);

  await segurar(pasta, "dois", "três", "--sair").fim;
  assert.equal(await contarLinhas(pasta), 3);

  // Com o banco em uso, a restauração recusa e nada muda.
  const a = segurar(pasta);
  t.after(() => a.filho.kill("SIGKILL"));
  await a.pronto;
  const recusa = await rodarScript("restaurar-backup.mjs", pasta, raiz, ["--ultimo", "--sim"]);
  assert.equal(recusa.codigo, 2);
  a.filho.kill("SIGTERM");
  await a.fim;
  assert.equal(await contarLinhas(pasta), 3);

  const r = await rodarScript("restaurar-backup.mjs", pasta, raiz, ["--ultimo", "--sim"]);
  assert.equal(r.codigo, 0, r.erro);
  assert.equal(await contarLinhas(pasta), 1, "voltou ao estado da cópia");
  const guardadas = fs.readdirSync(raiz).filter((n) => n.startsWith("pglite-antes-da-restauracao-"));
  assert.equal(guardadas.length, 1, "o banco anterior fica guardado ao lado");
  assert.equal(fs.existsSync(caminhoDaTrava(pasta)), false);

  // Retenção: sobram só as 3 mais novas.
  for (let i = 0; i < 4; i++) await copiarPastaFechada(pasta, "rodizio", { retencao: 3 });
  const restantes = listarBackups(pasta);
  assert.equal(restantes.length, 3);
  assert.ok(restantes.every((b) => b.motivo.startsWith("rodizio")), "a mais antiga (teste) foi a apagada");
});

test("dump pelo PGlite com o banco aberto e restauração a partir dele", async (t) => {
  const { raiz, pasta } = pastaTemporaria(t);
  await segurar(pasta, "um", "dois", "--sair").fim;

  const trava = adquirirTrava(pasta, { rotulo: "teste" });
  const cliente = await abrirPglite(pasta);
  const copia = await gravarDump(cliente, pasta, "aberto", { retencao: 3 });
  await cliente.query("insert into t (v) values ('depois do dump')");
  await cliente.close();
  trava.soltar();
  assert.equal(copia.tipo, "dump");
  assert.equal(await contarLinhas(pasta), 3);

  const r = await rodarScript("restaurar-backup.mjs", pasta, raiz, [copia.nome, "--sim"]);
  assert.equal(r.codigo, 0, r.erro);
  assert.equal(await contarLinhas(pasta), 2);
});
