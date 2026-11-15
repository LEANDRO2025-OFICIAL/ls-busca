// Restaura o banco embutido (.data/pglite) a partir de uma cópia de .data/backups.
// Feche o LS Busca antes: o script recusa (código 2) se o banco estiver em uso.
//
// Uso:
//   node scripts/restaurar-backup.mjs                 lista as cópias e pergunta qual restaurar
//   node scripts/restaurar-backup.mjs --listar        só lista
//   node scripts/restaurar-backup.mjs --ultimo --sim  restaura a mais recente sem perguntar
//   node scripts/restaurar-backup.mjs <nome> --sim    restaura a cópia com esse nome
//
// A pasta atual NÃO é apagada: fica ao lado, como pglite-antes-da-restauracao-<data>.
import fs from "node:fs";
import readline from "node:readline";
import { prepararScript } from "../src/lib/dados/banco-script.mjs";
import { listarBackups, moverPastaAtual, restaurarPasta, tamanhoEmBytes } from "../src/lib/dados/backup-banco.mjs";
import { abrirPglite } from "../src/lib/dados/migracoes.mjs";
import { encerrarProcesso } from "../src/lib/dados/trava-banco.mjs";

const args = process.argv.slice(2);
const tem = (opcao) => args.includes(opcao);
const nomePedido = args.find((a) => !a.startsWith("--"));

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => {
    rl.close();
    console.error("\nCancelado. Nada foi alterado.");
    void encerrarProcesso(1);
  });
  return new Promise((resolver) => rl.question(texto, (r) => (rl.close(), resolver(r.trim()))));
}

const { pasta } = await prepararScript({ rotulo: "restaurar-backup" });
const copias = listarBackups(pasta);
if (copias.length === 0) {
  console.error("Nenhuma cópia de segurança encontrada em .data/backups. Nada foi alterado.");
  await encerrarProcesso(1);
}
console.log("\nCópias de segurança (da mais nova para a mais antiga):");
copias.forEach((c, i) =>
  console.log(`  ${i + 1}. ${c.nome}  (${c.quando.toLocaleString("pt-BR")}, ${c.tipo}, ${Math.round(tamanhoEmBytes(c.caminho) / 1_048_576)} MB)`),
);
if (tem("--listar")) await encerrarProcesso(0);

let escolhida;
if (nomePedido) escolhida = copias.find((c) => c.nome === nomePedido);
else if (tem("--ultimo")) escolhida = copias[0];
else escolhida = copias[Number(await perguntar(`\nNúmero da cópia a restaurar [1-${copias.length}]: `)) - 1];
if (!escolhida) {
  console.error("\nCópia não encontrada. Nada foi alterado.");
  await encerrarProcesso(1);
}
if (!tem("--sim")) {
  const resposta = await perguntar(`\nO banco atual será trocado por ${escolhida.nome} (o atual fica guardado ao lado). Digite SIM para confirmar: `);
  if (resposta.toUpperCase() !== "SIM") {
    console.error("Cancelado. Nada foi alterado.");
    await encerrarProcesso(1);
  }
}

let guardada = null;
try {
  if (escolhida.tipo === "pasta") {
    ({ guardada } = await restaurarPasta(pasta, escolhida));
  } else {
    // Dump (.tar.gz do PGlite): o próprio PGlite descompacta em uma pasta nova.
    guardada = moverPastaAtual(pasta);
    const blob = new Blob([fs.readFileSync(escolhida.caminho)]);
    await (await abrirPglite(pasta, { loadDataDir: blob })).close();
  }
  // Confere que o banco restaurado abre e responde.
  const cliente = await abrirPglite(pasta);
  try {
    const { rows } = await cliente.query("select count(*)::int as n from _migracao");
    console.log(`\nBanco restaurado de ${escolhida.nome} e conferido (${rows[0].n} migrações registradas).`);
  } finally {
    await cliente.close();
  }
} catch (erro) {
  console.error(`\nA restauração falhou: ${erro.message}`);
  if (guardada) {
    // Volta ao que havia antes: a pasta meio restaurada sai do caminho e a original retorna.
    fs.rmSync(pasta, { recursive: true, force: true });
    fs.renameSync(guardada, pasta);
    console.error("O banco anterior foi colocado de volta. Nada foi alterado.");
  }
  await encerrarProcesso(1);
}
if (guardada) console.log(`O banco anterior ficou guardado em ${guardada}\n(ocupa espaço; apague quando tiver certeza de que não precisa dele).`);
await encerrarProcesso(0);
