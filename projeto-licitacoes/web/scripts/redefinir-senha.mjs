// Redefine a senha de uma conta direto no banco embutido (.data/pglite).
// Uso: node scripts/redefinir-senha.mjs   (ou "Redefinir senha LS Busca.bat")
//
// Recusa de verdade com o LS Busca no ar: confere a trava do banco e as portas 3000/3100 e, se
// houver alguém, sai com o código 2 sem abrir o banco. Códigos de saída: 0 = senha trocada;
// 1 = nada alterado (erro ou desistência); 2 = nada alterado porque o banco está em uso.
import { randomBytes, scrypt } from "node:crypto";
import readline from "node:readline";
import { abrirBancoDoScript, prepararScript } from "../src/lib/dados/banco-script.mjs";
import { bancoExiste, configuracaoDeBackup, copiarPastaFechada } from "../src/lib/dados/backup-banco.mjs";
import { encerrarProcesso } from "../src/lib/dados/trava-banco.mjs";

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
  // Ctrl+C durante a pergunta: fecha o banco e solta a trava antes de sair.
  rl.on("SIGINT", () => {
    rl.close();
    console.error("\nCancelado. Nada foi alterado.");
    void encerrarProcesso(1);
  });
  return new Promise((resolver) => rl.question(texto, (r) => (rl.close(), resolver(r))));
}

// Antes de qualquer coisa: trava + portas. Se o banco está em uso, termina aqui com código 2.
const { pasta } = await prepararScript({ rotulo: "redefinir-senha" });
if (!bancoExiste(pasta)) {
  console.error(`\nNada foi alterado: não há banco em ${pasta}. Abra o LS Busca uma vez e crie a conta.`);
  process.exit(1);
}

let banco = await abrirBancoDoScript(pasta);
try {
  const { rows } = await banco.cliente.query("select email, nome, papel from usuario order by created_at");
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

  // Cópia de segurança antes de escrever, com o banco fechado (cópia consistente).
  const config = configuracaoDeBackup();
  if (config.ativo) {
    await banco.fechar();
    console.log("\nFazendo cópia de segurança do banco antes de alterar. Pode levar alguns minutos...");
    const copia = await copiarPastaFechada(pasta, "senha", { retencao: config.retencao });
    if (copia) console.log(`Cópia pronta: ${copia.caminho}`);
    banco = await abrirBancoDoScript(pasta);
  }

  await banco.cliente.transaction(async (tx) => {
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
  await banco.fechar();
}
// Fecha o que restar e solta a trava antes de sair.
await encerrarProcesso(process.exitCode ?? 0);
