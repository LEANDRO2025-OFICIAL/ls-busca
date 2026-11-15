import { NextResponse, type NextRequest } from "next/server";
import { gerarIcs, tipoDoPrazo } from "@/lib/agenda";
import { autorizarApi } from "@/lib/api";
import { listarPrazos } from "@/lib/dados/prazos";

/** Prazos da organização em .ics (iCalendar), para importar em qualquer aplicativo de agenda. Exige sessão + licença. */
export async function GET(req: NextRequest) {
  const auth = await autorizarApi(req);
  if (!auth.ok) return auth.resposta;
  const { db, sessao } = auth;

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
