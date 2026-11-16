import { obterDb } from "@/lib/dados/db";
import { capturarResultados, janelaRetroativa } from "@/lib/dados/resultados";
import { autorizarCron } from "@/lib/segredo-cron";

export async function GET(request: Request) {
  const autorizacao = autorizarCron(request);
  if (!autorizacao.ok) {
    return Response.json({ erro: autorizacao.erro }, { status: autorizacao.status });
  }

  const url = new URL(request.url);
  const dias = Math.min(90, Math.max(1, Number(url.searchParams.get("dias") ?? "7")));
  const janela = janelaRetroativa(dias);

  try {
    const db = await obterDb();
    const resultado = await capturarResultados(db, janela);
    return Response.json(
      { gravados: resultado.gravados, erros: resultado.erros.length, janela },
      { status: resultado.erros.length > 0 ? 207 : 200 },
    );
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
