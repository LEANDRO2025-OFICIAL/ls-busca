// Redefine a senha de uma conta direto no banco local (.data/pglite).
// Feche o LS Busca antes: o PGlite só aceita um processo por vez na pasta.
// Uso: node scripts/redefinir-senha.mjs
import { randomBytes, scrypt } from "node:crypto";
import net from "node:net";
import path from "node:path";
import readline from "node:readline";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

// Mesmos parâmetros de gerarHash em src/lib/auth.ts.
const PARAMETROS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function gerarHash(senha) {
  const sal = randomBytes(16);
  return new Promise((resolver, rejeitar) =>
    scrypt(senha.normalize("NFKC"), sal, 64, PARAMETROS, (erro, chave) =>
      erro
        ? rejeitar(erro)
        : resolver(["scrypt", PARAMETROS.N, PARAMETROS.r, PARAMETROS.p, sal.toString("base64"), chave.toString("base64")].join("$")),
    ),
  );
}

function perguntar(texto, oculto = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Senha: mostra só a pergunta e a quebra de linha, nunca o que foi digitado.
  if (oculto) rl._writeToOutput = (s) => rl.output.write(s.startsWith(texto) ? texto : s.includes("\n") ? "\n" : "");
  return new Promise((resolver) => rl.question(texto, (r) => (rl.close(), resolver(r))));
}

// Dois processos no mesmo banco o corrompem: recusa se o LS Busca ainda responde na porta 3000.
const servidorNoAr = await new Promise((resolver) => {
  const s = net.connect(3000, "127.0.0.1", () => (s.destroy(), resolver(true)));
  s.on("error", () => resolver(false));
});
if (servidorNoAr) {
  console.error("\nO LS Busca ainda está aberto. Feche a janela \"LS Busca\" e rode de novo. Nada foi alterado.");
  process.exit(1);
}

const db = new PGlite(path.join(process.cwd(), ".data", "pglite"), { extensions: { pg_trgm, unaccent } });
try {
  const { rows } = await db.query("select email, nome, papel from usuario order by created_at");
  if (rows.length === 0) throw new Error("Nenhuma conta cadastrada.");
  console.log("\nContas cadastradas:");
  rows.forEach((u, i) => console.log(`  ${i + 1}. ${u.email}  (${u.nome}, ${u.papel})`));

  const escolha = Number(await perguntar(`\nNúmero da conta [1-${rows.length}]: `));
  const conta = rows[escolha - 1];
  if (!conta) throw new Error("Número inválido.");

  const nova = await perguntar("Nova senha (mínimo 10 caracteres, não aparece na tela): ", true);
  if (nova.length < 10 || nova.length > 200) throw new Error("A senha precisa ter de 10 a 200 caracteres.");
  if (nova !== (await perguntar("Repita a nova senha: ", true))) throw new Error("As senhas não conferem.");

  const hash = await gerarHash(nova);
  await db.transaction(async (tx) => {
    const { rows: u } = await tx.query("select id from usuario where email = $1", [conta.email]);
    await tx.query("update credencial set hash_senha = $1, updated_at = now() where usuario_id = $2", [hash, u[0].id]);
    // Derruba as sessões abertas: quem tinha a senha antiga perde o acesso.
    await tx.query("delete from sessao where usuario_id = $1", [u[0].id]);
  });
  console.log(`\nSenha de ${conta.email} trocada. Abra o LS Busca de novo e entre com ela.`);
} catch (erro) {
  console.error(`\nNada foi alterado: ${erro.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
