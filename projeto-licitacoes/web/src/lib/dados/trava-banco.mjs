// Trava de exclusão da pasta do PGlite.
//
// O PGlite (Postgres em WASM) não se protege de dois processos na mesma pasta: quando isso
// acontece, o WAL é sobrescrito e o banco para de abrir ("could not locate a valid checkpoint
// record"). Este módulo garante UM processo por pasta, com um arquivo de trava criado de forma
// atômica (open "wx") AO LADO da pasta de dados: <pasta>.lock.
//
// É .mjs puro (sem TypeScript, sem dependências) de propósito: o servidor (src/lib/dados/db.ts),
// o `next dev` e todos os scripts de scripts/*.mjs importam exatamente este arquivo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export class ErroBancoEmUso extends Error {
  /** @param {string} mensagem @param {object | null} dono */
  constructor(mensagem, dono) {
    super(mensagem);
    this.name = "ErroBancoEmUso";
    this.code = "BANCO_EM_USO";
    this.dono = dono;
  }
}

/** Pasta de dados padrão (pode ser trocada por PGLITE_PASTA, usada em testes e desenvolvimento). */
export function pastaDeDados(raiz = process.cwd()) {
  const personalizada = process.env.PGLITE_PASTA;
  return personalizada ? path.resolve(raiz, personalizada) : path.join(raiz, ".data", "pglite");
}

export function caminhoDaTrava(pasta) {
  return `${path.resolve(pasta)}.lock`;
}

/** true = existe um processo com este PID nesta máquina. */
export function processoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    // EPERM: existe, mas é de outro usuário. ESRCH: não existe.
    return erro.code === "EPERM";
  }
}

/** Lê a trava. null = não existe; { ilegivel: true } = existe mas não é JSON válido (ainda sendo gravada, ou truncada). */
export function lerTrava(pasta) {
  const arquivo = caminhoDaTrava(pasta);
  let texto;
  try {
    texto = fs.readFileSync(arquivo, "utf8");
  } catch (erro) {
    if (erro.code === "ENOENT") return null;
    throw erro;
  }
  try {
    const dono = JSON.parse(texto);
    if (dono && typeof dono === "object" && Number.isInteger(dono.pid)) return dono;
  } catch {
    // cai no retorno abaixo
  }
  return { ilegivel: true };
}

/**
 * Diz se a trava tem dono vivo. Trava de outra máquina (pasta em rede/sincronizada) conta como
 * viva: daqui não dá para conferir, e errar para o lado de "órfã" corromperia o banco.
 */
export function situacaoDaTrava(pasta) {
  const dono = lerTrava(pasta);
  if (!dono) return { estado: "livre", dono: null };
  if (dono.ilegivel) return { estado: "ilegivel", dono: null };
  if (dono.hostname && dono.hostname !== os.hostname()) return { estado: "viva", dono };
  // O computador reiniciou depois que a trava foi criada: o dono não pode estar vivo, mesmo que
  // o sistema tenha reaproveitado o número do PID para outro programa.
  const ligadoDesde = Date.now() - os.uptime() * 1000;
  const inicio = Date.parse(dono.inicio);
  if (Number.isFinite(inicio) && inicio < ligadoDesde - 60_000) return { estado: "orfa", dono };
  return { estado: processoVivo(dono.pid) ? "viva" : "orfa", dono };
}

export function descreverDono(dono) {
  if (!dono) return "outro processo";
  const partes = [`PID ${dono.pid}`];
  if (dono.rotulo) partes.push(dono.rotulo);
  if (dono.porta) partes.push(`porta ${dono.porta}`);
  if (dono.hostname) partes.push(`máquina ${dono.hostname}`);
  if (dono.inicio) partes.push(`desde ${dono.inicio}`);
  return partes.join(", ");
}

const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Estado por processo (sobrevive ao recarregamento de módulos do Next em desenvolvimento).
const estado = (globalThis.__lsTravaBanco ??= { travas: new Map(), fechamentos: new Set(), ganchos: false, encerrando: false });

function apagarSeForNossa(arquivo) {
  try {
    const dono = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    if (dono.pid === process.pid && dono.hostname === os.hostname()) fs.unlinkSync(arquivo);
  } catch {
    // já não existe, ou não é mais nossa: nada a fazer
  }
}

function soltarTodas() {
  for (const arquivo of estado.travas.keys()) apagarSeForNossa(arquivo);
  estado.travas.clear();
}

/**
 * Desligamento limpo: roda os fechamentos registrados (PGlite.close grava o checkpoint), solta
 * as travas e, se `codigo` não for null, encerra o processo com ele.
 */
export async function encerrarProcesso(codigo = 0) {
  if (estado.encerrando) return;
  estado.encerrando = true;
  // Limite de tempo: o Windows mata o processo poucos segundos depois de a janela ser fechada.
  const fechamentos = [...estado.fechamentos].map((f) => Promise.resolve().then(f).catch(() => {}));
  estado.fechamentos.clear();
  let relogio;
  await Promise.race([Promise.all(fechamentos), new Promise((r) => (relogio = setTimeout(r, 4000)))]);
  clearTimeout(relogio);
  soltarTodas();
  estado.encerrando = false;
  if (codigo != null) process.exit(codigo);
}

function instalarGanchos() {
  if (estado.ganchos) return;
  estado.ganchos = true;
  // "exit" é síncrono: só dá tempo de apagar o arquivo. É a rede de segurança dos demais.
  process.on("exit", soltarTodas);
  process.on("beforeExit", () => {
    if (estado.travas.size > 0 || estado.fechamentos.size > 0) void encerrarProcesso(null);
  });
  // SIGHUP: no Windows é o que o Node recebe quando a janela do console é fechada.
  // SIGBREAK: Ctrl+Break no Windows.
  for (const [sinal, codigo] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129], ["SIGBREAK", 149]]) {
    try {
      process.on(sinal, () => void encerrarProcesso(codigo));
    } catch {
      // sinal inexistente nesta plataforma
    }
  }
}

/** Registra uma função assíncrona para rodar no desligamento, antes de a trava ser solta (ex.: PGlite.close). */
export function aoEncerrar(fn) {
  instalarGanchos();
  estado.fechamentos.add(fn);
  return () => estado.fechamentos.delete(fn);
}

/** Porta em que este processo serve (PORT, ou -p/--port da linha de comando do `next`). */
export function portaDoProcesso() {
  if (process.env.PORT) return process.env.PORT;
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "-p" || args[i] === "--port") && args[i + 1]) return args[i + 1];
    const m = /^--port=(\d+)$/.exec(args[i]);
    if (m) return m[1];
  }
  return null;
}

function registrar(arquivo) {
  const trava = {
    arquivo,
    soltar() {
      if (estado.travas.get(arquivo) !== trava) return;
      estado.travas.delete(arquivo);
      apagarSeForNossa(arquivo);
    },
  };
  estado.travas.set(arquivo, trava);
  instalarGanchos();
  return trava;
}

/**
 * Remove uma trava morta (órfã ou ilegível). Só quem segura o arquivo "<trava>.recuperando"
 * (também criado com "wx") pode apagar uma trava alheia, e reconfere a situação depois de
 * tomá-lo: assim dois processos que encontram a mesma trava órfã nunca apagam a trava nova
 * um do outro.
 */
function removerTravaMorta(pasta, arquivo, aviso, aceitarIlegivel) {
  const mutex = `${arquivo}.recuperando`;
  let fd;
  try {
    fd = fs.openSync(mutex, "wx");
  } catch (erro) {
    if (erro.code !== "EEXIST") throw erro;
    // Outro processo está recuperando agora. Mutex abandonado (processo morto no meio) sai em 10 s.
    try {
      if (Date.now() - fs.statSync(mutex).mtimeMs > 10_000) fs.unlinkSync(mutex);
    } catch {
      // já saiu
    }
    dormir(50);
    return;
  }
  try {
    const { estado: situacao, dono } = situacaoDaTrava(pasta);
    if (situacao === "orfa" || (situacao === "ilegivel" && aceitarIlegivel)) {
      fs.unlinkSync(arquivo);
      aviso(
        situacao === "orfa"
          ? `[banco] Trava órfã encontrada (${descreverDono(dono)} não existe mais). Assumindo o banco; ` +
              "o Postgres embutido refaz sozinho o que ficou pendente no desligamento anterior."
          : "[banco] Arquivo de trava ilegível removido.",
      );
    }
  } catch (erro) {
    if (erro.code !== "ENOENT") throw erro;
  } finally {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(mutex);
    } catch {
      // já removido
    }
  }
}

/**
 * Toma a trava da pasta ou lança ErroBancoEmUso. Nunca abre nem toca a pasta de dados.
 * - trava inexistente: cria (atômico, flag "wx");
 * - trava deste mesmo processo: reaproveita;
 * - dono morto (ou computador reiniciado): assume, com aviso;
 * - dono vivo: recusa dizendo quem segura o banco.
 *
 * @param {string} pasta pasta de dados do PGlite
 * @param {{ rotulo?: string, porta?: number | string | null, aviso?: (m: string) => void }} [opcoes]
 * @returns {{ arquivo: string, soltar: () => void }}
 */
export function adquirirTrava(pasta, opcoes = {}) {
  const arquivo = caminhoDaTrava(pasta);
  const aviso = opcoes.aviso ?? ((m) => console.warn(m));
  if (estado.travas.has(arquivo)) return estado.travas.get(arquivo);
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });

  const conteudo = JSON.stringify(
    {
      pid: process.pid,
      porta: opcoes.porta ?? portaDoProcesso(),
      hostname: os.hostname(),
      inicio: new Date().toISOString(),
      rotulo: opcoes.rotulo ?? path.basename(process.argv[1] ?? "node"),
      comando: process.argv.slice(1, 4).join(" "),
    },
    null,
    2,
  );

  let ilegivelDesde = null;
  const limite = Date.now() + 15_000;
  while (Date.now() < limite) {
    try {
      const fd = fs.openSync(arquivo, "wx");
      try {
        fs.writeSync(fd, conteudo);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      return registrar(arquivo);
    } catch (erro) {
      if (erro.code !== "EEXIST") throw erro;
    }

    const { estado: situacao, dono } = situacaoDaTrava(pasta);
    if (situacao === "livre") continue; // sumiu entre o open e a leitura: tenta de novo
    if (situacao === "viva") {
      if (dono.pid === process.pid && dono.hostname === os.hostname()) {
        // Trava com o nosso PID que este processo não registrou: sobra de um processo morto cujo
        // número foi reaproveitado para nós. É nossa.
        fs.writeFileSync(arquivo, conteudo);
        return registrar(arquivo);
      }
      throw new ErroBancoEmUso(
        `O banco em ${path.resolve(pasta)} já está aberto por outro processo (${descreverDono(dono)}). ` +
          "Dois processos na mesma pasta corrompem o banco, então este não vai abrir. " +
          "Feche o outro (a janela \"LS Busca\", um `next dev` ou um script) e tente de novo. " +
          `Arquivo de trava: ${arquivo} (só apague à mão se tiver certeza de que nenhum programa do LS Busca está aberto).`,
        dono,
      );
    }
    if (situacao === "ilegivel") {
      // Pode ser outro processo no meio da gravação: espera até 2 s antes de considerar lixo.
      ilegivelDesde ??= Date.now();
      if (Date.now() - ilegivelDesde < 2000) {
        dormir(100);
        continue;
      }
    }
    removerTravaMorta(pasta, arquivo, aviso, ilegivelDesde != null && Date.now() - ilegivelDesde >= 2000);
  }
  throw new ErroBancoEmUso(`Não foi possível tomar a trava do banco em ${arquivo} (disputa com outro processo).`, null);
}

/** true se algo aceita conexão em 127.0.0.1:porta. */
export async function portaOcupada(porta, host = "127.0.0.1") {
  const net = await import("node:net");
  return new Promise((resolver) => {
    const s = net.connect({ port: porta, host });
    s.setTimeout(1500);
    s.once("connect", () => (s.destroy(), resolver(true)));
    s.once("timeout", () => (s.destroy(), resolver(false)));
    s.once("error", () => resolver(false));
  });
}

/** Portas em que o LS Busca costuma servir (produção e `next dev`). LS_BUSCA_PORTAS troca a lista. */
export function portasDoServidor(env = process.env) {
  const lista = String(env.LS_BUSCA_PORTAS ?? "")
    .split(",")
    .map((p) => Number.parseInt(p, 10))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536);
  return lista.length ? lista : [3000, 3100];
}

/**
 * Para scripts: confere a trava E as portas do servidor antes de qualquer coisa.
 * Devolve a lista de motivos para não abrir o banco (vazia = pode abrir). Não cria nem abre nada.
 */
export async function motivosParaNaoAbrir(pasta, portas = portasDoServidor()) {
  const motivos = [];
  const { estado: situacao, dono } = situacaoDaTrava(pasta);
  if (situacao === "viva") motivos.push(`o banco está travado por ${descreverDono(dono)}`);
  for (const porta of portas) {
    if (await portaOcupada(porta)) motivos.push(`há um programa respondendo na porta ${porta} (provavelmente o LS Busca)`);
  }
  return motivos;
}
