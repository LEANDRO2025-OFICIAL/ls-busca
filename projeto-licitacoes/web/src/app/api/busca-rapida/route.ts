import { NextResponse, type NextRequest } from "next/server";
import { autorizarApi } from "@/lib/api";
import { buscarLicitacoes } from "@/lib/dados/busca";

/** Busca rápida (Ctrl+K): até 8 licitações abertas por texto, órgão, processo ou CNPJ do órgão. Exige sessão + licença. */
export async function GET(req: NextRequest) {
  // Sessão + licença no servidor, e um freio simples (em memória, por instância) contra abuso.
  const auth = await autorizarApi(req, { max: 60, janelaMs: 60_000 });
  if (!auth.ok) return auth.resposta;
  const { db, sessao } = auth;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
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
