/**
 * Runner do robô real. Roda como tarefa assíncrona em background (não como processo separado).
 * Lê config e credenciais do banco, executa `executarRobo()` com o conector real e grava logs.
 */
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/dados/db";
import {
  atualizarEstadoSessao,
  gravarLog,
  lerEstadoSessao,
  obterCredencialComSenha,
} from "@/lib/dados/robo-sessao";
import { obterItemParaSimular } from "@/lib/dados/robo";
import { configDoItem } from "@/lib/robo/formulario";
import { executarRobo } from "@/lib/robo/conector";
import { ConectorComprasNet } from "@/lib/robo/portais/comprasnet";
import type { Controle } from "@/lib/robo/tipos";

export type PedidoRunner = {
  sessaoId: string;
  organizacaoId: string;
  roboItemId: string;
  credencialId: string | null;
  urlDisputa: string;
  passoMs?: number;
};

/** Lança o robô real em background. Nunca rejeita: erros viram estado 'erro' na sessão. */
export function iniciarRunnerBackground(db: Db, pedido: PedidoRunner): void {
  rodarSessao(db, pedido).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    atualizarEstadoSessao(db, pedido.sessaoId, "erro", msg).catch(() => {});
  });
}

async function rodarSessao(db: Db, pedido: PedidoRunner): Promise<void> {
  const { sessaoId, organizacaoId, roboItemId, credencialId, urlDisputa } = pedido;
  const passoMs = pedido.passoMs ?? 2_000;

  const registrar = (nivel: "info" | "lance" | "aviso" | "erro", texto: string, detalhe?: unknown) =>
    gravarLog(db, sessaoId, organizacaoId, { nivel, texto, detalhe }).catch(() => {});

  await registrar("info", "Iniciando sessão do robô.");

  const itemPara = await obterItemParaSimular(db, organizacaoId, roboItemId);
  if (!itemPara) {
    await atualizarEstadoSessao(db, sessaoId, "erro", "Item não encontrado.");
    return;
  }
  const config = configDoItem(itemPara.criterio, itemPara.item);
  const parametros = itemPara.parametros;

  if (!credencialId) {
    await atualizarEstadoSessao(db, sessaoId, "erro", "Nenhuma credencial informada. Configure o acesso ao portal.");
    return;
  }
  const credencial = await obterCredencialComSenha(db, organizacaoId, credencialId);
  if (!credencial) {
    await atualizarEstadoSessao(db, sessaoId, "erro", "Credencial não encontrada ou inativa.");
    return;
  }

  const conector = new ConectorComprasNet({
    login: credencial.login,
    senha: credencial.senha,
    urlDisputa,
    criterio: itemPara.criterio,
    onLog: (nivel, texto) => { registrar(nivel, texto).catch(() => {}); },
  });

  await atualizarEstadoSessao(db, sessaoId, "conectando");
  await registrar("info", "Conectando ao portal...");

  try {
    await conector.conectar();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await registrar("erro", `Falha ao conectar: ${msg}`);
    await atualizarEstadoSessao(db, sessaoId, "erro", msg);
    await conector.fechar();
    return;
  }

  await atualizarEstadoSessao(db, sessaoId, "em_disputa");
  await registrar("info", "Conectado. Robô em disputa.");

  const controle = async (): Promise<Controle> => {
    const estadoDb = await lerEstadoSessao(db, sessaoId).catch(() => "em_disputa" as const);
    if (estadoDb === "parado") return { paradaGlobal: true };
    const r = await db.execute<{ ativa: boolean }>(
      sql`select ativa from robo_parada where organizacao_id = ${organizacaoId}`
    ).catch(() => ({ rows: [] as { ativa: boolean }[] }));
    if (r.rows[0]?.ativa) return { paradaGlobal: true };
    return { paradaGlobal: false };
  };

  try {
    const resultado = await executarRobo({
      conector,
      config,
      parametros,
      controle,
      esperar: (ms) => new Promise((res) => setTimeout(res, ms)),
      passoMs,
    });

    const estadoPos = await lerEstadoSessao(db, sessaoId);
    if (estadoPos === "parado") {
      await registrar("aviso", "Robô parado por parada de emergência.");
      return;
    }
    const ultimo = resultado.registros[resultado.registros.length - 1];
    const motivo = ultimo?.motivo ?? "Disputa encerrada.";
    const aceitos = resultado.registros.filter((r) => r.acao === "lancar" && r.envio === "aceito").length;
    const resumo = `Encerrado. Passos: ${resultado.registros.length}, lances aceitos: ${aceitos}. ${motivo}`;
    await registrar("info", resumo);
    await atualizarEstadoSessao(db, sessaoId, "encerrado", resumo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await registrar("erro", `Erro durante a disputa: ${msg}`);
    await atualizarEstadoSessao(db, sessaoId, "erro", msg);
  } finally {
    await conector.fechar();
  }
}
