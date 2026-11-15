import { NextResponse } from "next/server";
import { obterDb } from "@/lib/dados/db";
import { buscarLogs, lerEstadoSessao, type EstadoSessao } from "@/lib/dados/robo-sessao";
import { lerSessao } from "@/lib/auth";

const ESTADOS_TERMINAIS = new Set<EstadoSessao>(["encerrado", "erro", "parado"]);

export async function GET(req: Request, { params }: { params: Promise<{ sessaoId: string }> }) {
  const { sessaoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessaoId)) return NextResponse.json({ erro: "inválido" }, { status: 400 });

  const db = await obterDb();
  const sessao = await lerSessao(db);
  if (!sessao) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const { organizacaoId } = sessao;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enc = (ev: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));

      let ultimoId: string | undefined;
      let intervalo = 1500;

      while (!req.signal.aborted) {
        try {
          const logs = await buscarLogs(db, sessaoId, organizacaoId, ultimoId);
          for (const entry of logs) {
            enc("log", entry);
            ultimoId = entry.id;
          }
          const estado = await lerEstadoSessao(db, sessaoId);
          enc("status", { estado });
          if (!estado || ESTADOS_TERMINAIS.has(estado)) {
            controller.close();
            return;
          }
          intervalo = 1500;
        } catch {
          intervalo = Math.min(intervalo * 2, 10_000);
        }
        await new Promise<void>((res, rej) => {
          const t = setTimeout(res, intervalo);
          req.signal.addEventListener("abort", () => { clearTimeout(t); rej(); }, { once: true });
        }).catch(() => {});
        if (req.signal.aborted) break;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
