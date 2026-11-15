// Porta de entrada única dos scripts (scripts/*.mjs) para o banco embutido (PGlite).
// Todo script chama prepararScript() ANTES de qualquer coisa: ele confere a trava e as portas do
// servidor, toma a trava e só então devolve a pasta. Se o banco está em uso, o processo termina
// com o código 2 sem criar, abrir ou alterar nada na pasta de dados.
import fs from "node:fs";
import path from "node:path";
import { ErroBancoEmUso, adquirirTrava, aoEncerrar, motivosParaNaoAbrir, pastaDeDados } from "./trava-banco.mjs";
import { abrirPglite } from "./migracoes.mjs";

/** Código de saída quando o banco está em uso por outro programa. */
export const SAIDA_BANCO_EM_USO = 2;

/** DATABASE_URL do ambiente ou de .env.local/.env (os scripts não passam pelo Next, que é quem lê esses arquivos). */
export function urlDoPostgres(raiz = process.cwd(), env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  for (const nome of [".env.local", ".env"]) {
    let texto;
    try {
      texto = fs.readFileSync(path.join(raiz, nome), "utf8");
    } catch {
      continue;
    }
    const m = /^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n#]+)/m.exec(texto);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

/**
 * @param {{ rotulo: string }} opcoes
 * @returns {Promise<{ pasta: string, trava: { arquivo: string, soltar(): void } }>}
 */
export async function prepararScript({ rotulo }) {
  if (urlDoPostgres()) {
    console.error(
      "\nEste computador está configurado com DATABASE_URL (Postgres de verdade). Este script só mexe no banco " +
        "embutido em .data/pglite, que não está em uso. Nada foi alterado.",
    );
    process.exit(1);
  }
  const pasta = pastaDeDados();
  const recusar = (motivos) => {
    console.error("\nO LS Busca (ou outro programa que usa o banco) está aberto:");
    for (const m of motivos) console.error(`  - ${m}`);
    console.error(
      "\nDois programas no mesmo banco o corrompem, então este script não vai abrir o banco." +
        "\nFeche a janela \"LS Busca\" (e qualquer `npm run dev`) e rode de novo. Nada foi alterado.",
    );
    process.exit(SAIDA_BANCO_EM_USO);
  };
  const motivos = await motivosParaNaoAbrir(pasta);
  if (motivos.length) recusar(motivos);
  try {
    return { pasta, trava: adquirirTrava(pasta, { rotulo }) };
  } catch (erro) {
    if (erro instanceof ErroBancoEmUso) recusar([erro.message]);
    throw erro;
  }
}

/** Abre o PGlite (a trava já deve estar tomada) e garante o fechamento limpo no desligamento. */
export async function abrirBancoDoScript(pasta) {
  const cliente = await abrirPglite(pasta);
  const esquecer = aoEncerrar(() => cliente.close());
  return {
    cliente,
    async fechar() {
      esquecer();
      if (!cliente.closed) await cliente.close();
    },
  };
}
