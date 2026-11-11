import { copiaAntesDeEscritaMassiva, obterDb } from "@/lib/dados/db";
import { avisarSemDerrubar, ingerir, MODALIDADES_COM_PROPOSTA, semear } from "@/lib/dados/ingestao";

export async function GET(request: Request) {
  // Ler o cabeçalho também torna a rota dinâmica (nunca pré-renderizada no build).
  const autorizacao = request.headers.get("authorization");
  const segredo = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && (!segredo || autorizacao !== `Bearer ${segredo}`)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }

  const db = await obterDb();
  // ?somente=avisos: só casa o que já está na base com os alertas (sem falar com o PNCP).
  if (new URL(request.url).searchParams.get("somente") === "avisos") {
    return Response.json({ avisos: await avisarSemDerrubar(db) });
  }
  // Ingestão é escrita em lote: garante uma cópia de segurança recente antes (no máximo uma por período).
  await copiaAntesDeEscritaMassiva("ingestao");
  // Brasil inteiro, uma fatia por modalidade. Cada chamada processa o que couber no
  // orçamento de tempo; a próxima retoma de onde parou.
  for (const modalidade of MODALIDADES_COM_PROPOSTA) {
    await semear(db, { modalidade, uf: null });
  }
  const resultado = await ingerir(db, { orcamentoMs: 240_000 });
  return Response.json(resultado, { status: resultado.erros.length ? 502 : 200 });
}
