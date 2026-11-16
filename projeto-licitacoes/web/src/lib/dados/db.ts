import dns from "node:dns";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

// Railway (e outros ambientes sem IPv6) falham com ENETUNREACH quando Node.js 18+
// resolve um hostname para IPv6. Força IPv4 globalmente para todo o processo.
dns.setDefaultResultOrder("ipv4first");
import { adquirirTrava, aoEncerrar, pastaDeDados } from "./trava-banco.mjs";
import { abrirPglite, aplicarMigracoes, executorPglite, migracoesPendentes, type Executor } from "./migracoes.mjs";
import {
  bancoExiste,
  configuracaoDeBackup,
  copiarPastaFechada,
  gravarDump,
  horasDesdeOUltimoBackup,
  tamanhoEmBytes,
} from "./backup-banco.mjs";

// Com DATABASE_URL: Postgres de verdade (local, Neon, Supabase...) pelo driver pg. É o recomendado.
// Sem ela: Postgres 17 embutido (PGlite) em .data/pglite.
// O SQL das migrações e as consultas são os mesmos nos dois casos.
//
// O PGlite só aceita UM processo por pasta (dois corrompem o banco). Por isso, antes de abrir a
// pasta, este módulo toma a trava de trava-banco.mjs; os scripts fazem o mesmo (banco-script.mjs).

export type Db = PgliteDatabase<typeof schema>;

// Organização semeada só em desenvolvimento (dados antigos da fatia vertical).
export const ORG_DEV = "00000000-0000-4000-8000-000000000001";

// Uma instância por processo: o PGlite não aceita dois clientes na mesma pasta,
// e o recarregamento do Next em dev reexecutaria este módulo.
const global = globalThis as unknown as { __db?: Promise<Db>; __pglite?: PGlite; __avisouBackupGrande?: boolean };

export function obterDb(): Promise<Db> {
  global.__db ??= iniciar().catch((erro) => {
    global.__db = undefined;
    throw erro;
  });
  return global.__db;
}

/**
 * Chamado por src/instrumentation.ts quando o servidor sobe. Se outro processo já segura o banco
 * embutido, este termina aqui (código 1) com a mensagem que diz quem é, sem abrir a pasta.
 */
export async function abrirNaPartida(): Promise<void> {
  try {
    await obterDb();
  } catch (erro) {
    if ((erro as { code?: string } | null)?.code === "BANCO_EM_USO") {
      console.error(`\n[banco] ${(erro as Error).message}\n`);
      process.exit(1);
    }
    // Outros erros (ex.: Postgres remoto fora do ar): o servidor sobe e tenta de novo a cada pedido.
    console.error("[banco] Falha ao abrir o banco na partida:", erro);
  }
}

async function iniciar(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  return url ? iniciarPostgres(url) : iniciarPglite();
}

async function iniciarPglite(): Promise<Db> {
  const pasta = pastaDeDados();
  // Lança ErroBancoEmUso, sem tocar na pasta, se outro processo vivo segura o banco.
  const trava = adquirirTrava(pasta, { rotulo: process.env.NODE_ENV === "production" ? "servidor LS Busca" : "next dev" });
  let cliente: PGlite | undefined;
  try {
    const existia = bancoExiste(pasta);
    cliente = await abrirPglite(pasta);
    const config = configuracaoDeBackup();
    if (existia && config.ativo) {
      // Cópia de segurança antes de escrita massiva: migração nova, ou a cópia periódica que
      // antecede a ingestão do dia. Só depois de o banco abrir bem (não se copia banco quebrado
      // por cima das cópias boas) e sempre com ele FECHADO, para a cópia sair consistente.
      const pendentes = await migracoesPendentes(executorPglite(cliente));
      const vencida = config.intervaloHoras > 0 && horasDesdeOUltimoBackup(pasta) >= config.intervaloHoras;
      const motivo = pendentes.length > 0 ? "migracao" : vencida ? "periodico" : null;
      if (motivo) {
        await cliente.close();
        cliente = undefined;
        console.log(`[banco] Fazendo cópia de segurança (${motivo}) antes de continuar. Pode levar alguns minutos...`);
        try {
          const copia = await copiarPastaFechada(pasta, motivo, { retencao: config.retencao });
          if (copia) console.log(`[banco] Cópia pronta: ${copia.caminho}`);
        } catch (erro) {
          if (motivo === "migracao") {
            throw new Error(
              `Não foi possível fazer a cópia de segurança antes da migração ${pendentes.join(", ")}: ${(erro as Error).message}. ` +
                "Libere espaço em disco e abra de novo (ou defina BACKUP_AUTOMATICO=0 para seguir sem cópia).",
              { cause: erro },
            );
          }
          console.warn(`[banco] A cópia de segurança periódica falhou (${(erro as Error).message}). O sistema segue sem ela.`);
        }
        cliente = await abrirPglite(pasta);
      }
    }
    await prepararBanco(executorPglite(cliente));
  } catch (erro) {
    await cliente?.close().catch(() => {});
    trava.soltar();
    throw erro;
  }
  // No desligamento (janela fechada, Ctrl+C, SIGTERM): fecha o Postgres embutido e só então solta a trava.
  const aberto = cliente;
  aoEncerrar(() => aberto.close());
  global.__pglite = aberto;
  return drizzle({ client: aberto, schema });
}

/**
 * Chame antes de uma escrita massiva com o servidor no ar (ex.: ingestão em lote). Com o banco
 * embutido e a última cópia vencida (BACKUP_INTERVALO_HORAS), grava um dump consistente pelo
 * próprio PGlite. O dump é montado em memória, então bancos acima de BACKUP_DUMP_MAX_MB ficam
 * para a cópia de pasta feita na próxima abertura. Nunca lança: falha de cópia vira aviso.
 */
export async function copiaAntesDeEscritaMassiva(motivo: string): Promise<void> {
  const cliente = global.__pglite;
  if (!cliente || cliente.closed) return;
  try {
    const config = configuracaoDeBackup();
    const pasta = pastaDeDados();
    if (!config.ativo || config.intervaloHoras <= 0 || horasDesdeOUltimoBackup(pasta) < config.intervaloHoras) return;
    const megabytes = tamanhoEmBytes(pasta) / 1_048_576;
    if (megabytes > config.dumpMaxMb) {
      if (!global.__avisouBackupGrande) {
        global.__avisouBackupGrande = true;
        console.warn(
          `[banco] Cópia de segurança vencida, mas o banco (${Math.round(megabytes)} MB) é grande demais para copiar com o ` +
            "sistema aberto. Ela será feita na próxima vez que o LS Busca for aberto.",
        );
      }
      return;
    }
    const copia = await gravarDump(cliente, pasta, motivo, { retencao: config.retencao });
    console.log(`[banco] Cópia de segurança (${motivo}) gravada em ${copia.caminho}`);
  } catch (erro) {
    console.warn(`[banco] A cópia de segurança antes de "${motivo}" falhou: ${(erro as Error).message}`);
  }
}

async function iniciarPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const { drizzle: drizzlePg } = await import("drizzle-orm/node-postgres");
  // SSL: valida o certificado do servidor. Antes era { rejectUnauthorized: false }, que aceita
  // qualquer certificado e anula a proteção contra intermediário na conexão com o banco.
  // Bancos gerenciados (Supabase, Neon) usam CA pública — validação padrão funciona com ?sslmode=require.
  const semUrl = !/[?&]sslmode=/.test(url);
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  const semVerificacao = process.env.DATABASE_SSL_NO_VERIFY === "1";
  const ssl = semVerificacao
    ? { rejectUnauthorized: false as const }
    : ca
      ? { rejectUnauthorized: true as const, ca }
      : { rejectUnauthorized: true as const };
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: semUrl && process.env.NODE_ENV !== "production" ? undefined : ssl,
  });
  // Sem este handler, uma conexão ociosa derrubada pelo provedor (comum no Supabase) emite
  // 'error' e DERRUBA o processo inteiro.
  pool.on("error", (erro) => {
    console.error("[LS Busca] Erro em conexão ociosa do pool do banco:", erro);
  });
  try {
    const c = await pool.connect();
    c.release();
  } catch (erro) {
    console.error("[LS Busca] Erro ao conectar com o banco:", erro);
    throw erro;
  }
  const executor: Executor = {
    exec: async (s) => void (await pool.query(s)),
    consulta: async <T,>(s: string, p?: unknown[]) => (await pool.query(s, p)).rows as T[],
    emTransacao: async (fn) => {
      const conexao = await pool.connect();
      try {
        await conexao.query("begin");
        await fn({
          exec: async (s) => void (await conexao.query(s)),
          consulta: async <T,>(s: string, p?: unknown[]) => (await conexao.query(s, p)).rows as T[],
          emTransacao: () => Promise.reject(),
        });
        await conexao.query("commit");
      } catch (erro) {
        await conexao.query("rollback");
        throw erro;
      } finally {
        conexao.release();
      }
    },
  };
  await prepararBanco(executor);
  // Mesma API do Drizzle usada pelo app (select/insert/update/execute/transaction; execute devolve { rows }).
  return drizzlePg({ client: pool, schema }) as unknown as Db;
}

async function prepararBanco(banco: Executor) {
  await aplicarMigracoes(banco);
  if (process.env.NODE_ENV !== "production") {
    await banco.consulta(
      `insert into organizacao (id, nome) values ($1, 'Organização de desenvolvimento') on conflict (id) do nothing`,
      [ORG_DEV],
    );
    // A organização de desenvolvimento não deve esbarrar no bloqueio de avaliação/licença.
    await banco.consulta(
      `update organizacao set licenca_estado = 'ativa', licenca_expira_em = null where id = $1 and licenca_estado <> 'ativa'`,
      [ORG_DEV],
    );
  }
}
