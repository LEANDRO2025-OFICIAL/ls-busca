import { NextResponse, type NextRequest } from "next/server";
import { gerarIcs, tipoDoPrazo } from "@/lib/agenda";
import { lerSessao } from "@/lib/auth";
import { obterDb } from "@/lib/dados/db";
import { listarPrazos } from "@/lib/dados/prazos";

/** Prazos da organização em .ics (iCalendar), para importar em qualquer aplicativo de agenda. Exige sessão. */
export async function GET(req: NextRequest) {
  const db = await obterDb();
  const sessao = await lerSessao(db);
  if (!sessao) return NextResponse.json({ erro: "Entre para exportar os prazos." }, { status: 401 });

  // Endereço pelo qual a pessoa chegou (atrás de proxy, o do cabeçalho), para os links dos eventos.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origem = host ? `${req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")}://${host}` : req.nextUrl.origin;
  const prazos = await listarPrazos(db, sessao.organizacaoId);
  const ics = gerarIcs(
    prazos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      quando: p.quando,
      tipo: tipoDoPrazo(p),
      descricao: p.objeto,
      url: `${origem}${p.href}`,
    })),
    new Date(),
  );
  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="prazos-licitacoes.ics"',
      "cache-control": "no-store",
    },
  });
}
