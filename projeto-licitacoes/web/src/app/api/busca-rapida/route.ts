import { NextResponse, type NextRequest } from "next/server";
import { lerSessao } from "@/lib/auth";
import { buscarLicitacoes } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";

/** Busca rápida (Ctrl+K): até 8 licitações abertas por texto, órgão, processo ou CNPJ do órgão. Exige sessão. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  const db = await obterDb();
  const sessao = await lerSessao(db);
  if (!sessao) return NextResponse.json({ erro: "Entre para buscar." }, { status: 401 });
  if (q.length < 2) return NextResponse.json({ total: 0, resultados: [] });

  const { total, linhas } = await buscarLicitacoes(db, sessao.organizacaoId, {
    q,
    uf: null,
    modalidade: null,
    valorMinCentavos: null,
    valorMaxCentavos: null,
    encerraEmDias: null,
    pagina: 1,
    perfil: null,
    apenasRamo: false,
  });
  return NextResponse.json(
    {
      total,
      resultados: linhas.slice(0, 8).map((l) => ({
        id: l.numeroControle,
        objeto: l.objeto,
        orgao: l.orgao,
        uf: l.uf,
        municipio: l.municipio,
        valorCentavos: l.valorCentavos,
        href: `/licitacao/${l.cnpj}/${l.ano}/${l.sequencial}`,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
