import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const AUXILIAR = path.join(WEB, "tests", "auxiliar", "segurar-banco.mjs");
export const script = (nome) => path.join(WEB, "scripts", nome);

/** Pasta temporária FORA do repositório; os testes nunca tocam em web/.data. */
export function pastaTemporaria(t) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ls-busca-teste-"));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  return { raiz, pasta: path.join(raiz, "pglite") };
}

/** Roda node com os argumentos dados. `pronto` resolve quando a saída traz "PRONTO"; `fim` quando o processo termina. */
export function rodar(args, { env = {}, cwd } = {}) {
  const ambiente = { ...process.env, ...env };
  delete ambiente.DATABASE_URL;
  delete ambiente.NODE_TEST_CONTEXT;
  const filho = spawn(process.execPath, args, { env: ambiente, cwd, stdio: ["ignore", "pipe", "pipe"] });
  const r = { filho, saida: "", erro: "" };
  let avisarPronto;
  r.pronto = new Promise((resolver) => (avisarPronto = resolver));
  filho.stdout.on("data", (d) => {
    r.saida += d;
    if (r.saida.includes("PRONTO")) avisarPronto(r);
  });
  filho.stderr.on("data", (d) => (r.erro += d));
  r.fim = new Promise((resolver) =>
    filho.on("close", (codigo, sinal) => {
      r.codigo = codigo;
      r.sinal = sinal;
      avisarPronto(r);
      resolver(r);
    }),
  );
  return r;
}

export const segurar = (pasta, ...args) => rodar([AUXILIAR, pasta, ...args]);

/** Quantas linhas a tabela t tem, lidas por um processo novo que abre e fecha o banco. */
export async function contarLinhas(pasta) {
  const r = await segurar(pasta, "--sair").fim;
  const m = /PRONTO (\d+)/.exec(r.saida);
  if (r.codigo !== 0 || !m) throw new Error(`não abriu: código ${r.codigo}\n${r.saida}\n${r.erro}`);
  return Number(m[1]);
}

/** PID de um processo que com certeza já terminou. */
export async function pidMorto() {
  const r = rodar(["-e", ""]);
  await r.fim;
  return r.filho.pid;
}

export function portaLivre() {
  return new Promise((resolver) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolver(port));
    });
  });
}

/** Retrato da pasta (caminho, tamanho, data): muda se alguém gravar nela. */
export function retrato(pasta) {
  const linhas = [];
  const andar = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const caminho = path.join(dir, item.name);
      if (item.isDirectory()) andar(caminho);
      else {
        const info = fs.statSync(caminho);
        linhas.push(`${path.relative(pasta, caminho)} ${info.size} ${info.mtimeMs}`);
      }
    }
  };
  andar(pasta);
  return linhas.join("\n");
}
