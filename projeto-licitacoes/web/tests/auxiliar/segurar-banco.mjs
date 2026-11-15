// Processo auxiliar dos testes: toma a trava, abre o PGlite, aplica as migrações reais e grava.
// Uso: node segurar-banco.mjs <pasta> [--sair] [--so-trava] [valor...]
//   --sair      fecha limpo e termina (código 0) depois de gravar
//   --so-trava  só toma a trava (não abre o banco) e a segura por 1,5 s
// Sai com o código 2 se o banco estiver em uso. Sem --sair, fica vivo até receber um sinal.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ErroBancoEmUso, adquirirTrava, aoEncerrar, encerrarProcesso } from "../../src/lib/dados/trava-banco.mjs";
import { abrirPglite, aplicarMigracoes, executorPglite } from "../../src/lib/dados/migracoes.mjs";

const [pasta, ...resto] = process.argv.slice(2);
const valores = resto.filter((a) => !a.startsWith("--"));
const migracoes = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "db", "migracoes");

try {
  adquirirTrava(pasta, { rotulo: "teste" });
} catch (erro) {
  if (!(erro instanceof ErroBancoEmUso)) throw erro;
  console.error(erro.message);
  process.exit(2);
}

if (resto.includes("--so-trava")) {
  console.log("PRONTO");
  setTimeout(() => void encerrarProcesso(0), 1500);
} else {
  const cliente = await abrirPglite(pasta);
  aoEncerrar(() => cliente.close());
  await aplicarMigracoes(executorPglite(cliente), migracoes);
  await cliente.exec("create table if not exists t (id serial primary key, v text not null)");
  for (const v of valores) await cliente.query("insert into t (v) values ($1)", [v]);
  const { rows } = await cliente.query("select count(*)::int as n from t");
  console.log(`PRONTO ${rows[0].n}`);
  if (resto.includes("--sair")) await encerrarProcesso(0);
  else setInterval(() => {}, 1000);
}
