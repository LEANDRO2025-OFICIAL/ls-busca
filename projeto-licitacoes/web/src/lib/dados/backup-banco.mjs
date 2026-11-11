// Cópias de segurança da pasta do PGlite. .mjs puro: usado pelo servidor (db.ts) e pelos scripts.
//
// Dois formatos, ambos consistentes:
//  - "pasta": cópia da pasta inteira, feita SÓ com o banco fechado (quem chama segura a trava
//    e ainda não abriu o PGlite). É o formato padrão: não depende de memória.
//  - "dump": .tar.gz gerado pelo próprio PGlite (dumpDataDir) com o banco aberto. O arquivo é
//    montado em memória, então só é usado em bancos pequenos (ver BACKUP_DUMP_MAX_MB).
//
// Quando são feitas (db.ts e scripts): antes de migração nova, antes de redefinir senha, antes de
// restaurar, e uma periódica (BACKUP_INTERVALO_HORAS, padrão 24; 0 desliga) que antecede a ingestão.
//
// Ficam em <pasta-pai>/backups (padrão: web/.data/backups), com carimbo de data no nome.
// Cada cópia ocupa o mesmo espaço do banco: a retenção padrão é 3 (BACKUP_RETENCAO).
import fs from "node:fs";
import path from "node:path";

const PREFIXO = "pglite-";
const PADRAO = /^pglite-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})-([a-z0-9-]+?)(\.tar\.gz)?$/;

function inteiro(valor, padrao, minimo = 0) {
  const n = Number.parseInt(String(valor ?? ""), 10);
  return Number.isFinite(n) && n >= minimo ? n : padrao;
}

/** Configuração lida do ambiente (documentada em .env.example). */
export function configuracaoDeBackup(env = process.env) {
  return {
    ativo: !["0", "false", "nao", "não"].includes(String(env.BACKUP_AUTOMATICO ?? "1").toLowerCase()),
    retencao: inteiro(env.BACKUP_RETENCAO, 3, 1),
    intervaloHoras: inteiro(env.BACKUP_INTERVALO_HORAS, 24, 0),
    dumpMaxMb: inteiro(env.BACKUP_DUMP_MAX_MB, 512, 0),
  };
}

export function pastaDeBackups(pastaDados) {
  return path.join(path.dirname(path.resolve(pastaDados)), "backups");
}

/** O banco já foi criado nesta pasta? (PG_VERSION é o primeiro arquivo que o Postgres grava.) */
export function bancoExiste(pastaDados) {
  return fs.existsSync(path.join(pastaDados, "PG_VERSION"));
}

function carimbo(data = new Date()) {
  const d = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${d(data.getMonth() + 1)}-${d(data.getDate())}_${d(data.getHours())}${d(data.getMinutes())}${d(data.getSeconds())}`;
}

function nomeLivre(destino, motivo, sufixo = "") {
  const limpo = String(motivo).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "manual";
  let nome = `${PREFIXO}${carimbo()}-${limpo}`;
  for (let i = 2; fs.existsSync(path.join(destino, nome + sufixo)); i++) nome = `${PREFIXO}${carimbo()}-${limpo}-${i}`;
  return nome + sufixo;
}

export function tamanhoEmBytes(caminho) {
  let total = 0;
  let info;
  try {
    info = fs.statSync(caminho);
  } catch {
    return 0;
  }
  if (!info.isDirectory()) return info.size;
  for (const item of fs.readdirSync(caminho, { withFileTypes: true })) {
    total += tamanhoEmBytes(path.join(caminho, item.name));
  }
  return total;
}

/** Cópias completas, da mais nova para a mais antiga. Só enxerga nomes gerados por este módulo. */
export function listarBackups(pastaDados) {
  const destino = pastaDeBackups(pastaDados);
  let itens;
  try {
    itens = fs.readdirSync(destino);
  } catch {
    return [];
  }
  return itens
    .map((nome) => {
      const m = PADRAO.exec(nome);
      if (!m) return null;
      const quando = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      return { nome, caminho: path.join(destino, nome), tipo: m[8] ? "dump" : "pasta", motivo: m[7], quando };
    })
    .filter(Boolean)
    .sort((a, b) => b.quando - a.quando || (a.nome < b.nome ? 1 : -1));
}

export function horasDesdeOUltimoBackup(pastaDados) {
  const [ultimo] = listarBackups(pastaDados);
  return ultimo ? (Date.now() - ultimo.quando.getTime()) / 3_600_000 : Infinity;
}

/** Apaga as cópias mais antigas, deixando `manter`. Nunca toca em nada fora do padrão de nome. */
export function aplicarRetencao(pastaDados, manter = configuracaoDeBackup().retencao) {
  const apagados = [];
  for (const b of listarBackups(pastaDados).slice(Math.max(1, manter))) {
    fs.rmSync(b.caminho, { recursive: true, force: true });
    apagados.push(b.nome);
  }
  // Restos de cópias interrompidas.
  try {
    for (const nome of fs.readdirSync(pastaDeBackups(pastaDados))) {
      if (nome.endsWith(".parcial")) fs.rmSync(path.join(pastaDeBackups(pastaDados), nome), { recursive: true, force: true });
    }
  } catch {
    // pasta de backups ainda não existe
  }
  return apagados;
}

/**
 * Copia a pasta de dados. PRÉ-CONDIÇÃO: quem chama segura a trava e o PGlite está FECHADO.
 * Copia para um nome ".parcial" e renomeia no fim, então uma cópia interrompida nunca parece válida.
 */
export async function copiarPastaFechada(pastaDados, motivo, opcoes = {}) {
  if (!bancoExiste(pastaDados)) return null;
  const destino = pastaDeBackups(pastaDados);
  fs.mkdirSync(destino, { recursive: true });
  const nome = nomeLivre(destino, motivo);
  const parcial = path.join(destino, `${nome}.parcial`);
  await fs.promises.cp(pastaDados, parcial, { recursive: true, errorOnExist: true, force: false });
  fs.renameSync(parcial, path.join(destino, nome));
  const apagados = aplicarRetencao(pastaDados, opcoes.retencao);
  return { nome, caminho: path.join(destino, nome), tipo: "pasta", apagados };
}

/** Dump lógico com o banco aberto (cliente = instância do PGlite). Faz CHECKPOINT antes. */
export async function gravarDump(cliente, pastaDados, motivo, opcoes = {}) {
  const destino = pastaDeBackups(pastaDados);
  fs.mkdirSync(destino, { recursive: true });
  const nome = nomeLivre(destino, motivo, ".tar.gz");
  await cliente.exec("checkpoint");
  const blob = await cliente.dumpDataDir("gzip");
  const parcial = path.join(destino, `${nome}.parcial`);
  fs.writeFileSync(parcial, Buffer.from(await blob.arrayBuffer()));
  fs.renameSync(parcial, path.join(destino, nome));
  const apagados = aplicarRetencao(pastaDados, opcoes.retencao);
  return { nome, caminho: path.join(destino, nome), tipo: "dump", apagados };
}

/**
 * Troca a pasta de dados por uma cópia do tipo "pasta". PRÉ-CONDIÇÃO: trava tomada, PGlite fechado.
 * A pasta atual NÃO é apagada: vira <pasta>-antes-da-restauracao-<carimbo>, ao lado.
 * Para o tipo "dump" veja scripts/restaurar-backup.mjs (precisa do PGlite para descompactar).
 */
export async function restaurarPasta(pastaDados, backup) {
  const guardada = moverPastaAtual(pastaDados);
  await fs.promises.cp(backup.caminho, pastaDados, { recursive: true });
  return { guardada };
}

export function moverPastaAtual(pastaDados) {
  if (!fs.existsSync(pastaDados)) return null;
  const guardada = `${path.resolve(pastaDados)}-antes-da-restauracao-${carimbo()}`;
  fs.renameSync(pastaDados, guardada);
  return guardada;
}
