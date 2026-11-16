import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SearchX, Sparkles } from "lucide-react";
import { acaoAcompanhar } from "@/app/acoes";
import { Esqueleto, EstadoVazio } from "@/components/ui/basicos";
import { FiltroLink } from "@/components/ui/busca";
import { CabecalhoLista, LinhaLicitacao } from "@/components/ui/licitacao";
import { aderenciaDaLinha, buscarLicitacoes, filtrosDoRamo, inicioDasNovas, POR_PAGINA } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";
import { obterPerfil } from "@/lib/dados/perfil";
import { ehEtapa, NOME_ETAPA } from "@/lib/etapas";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Para sua empresa" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

export default function PaginaParaVoce({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-conteudo flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Para sua empresa</h1>
        <p className="text-sm text-muted">
          Licitações abertas que combinam com o ramo da sua empresa, das que mais combinam para as que menos combinam.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function href(novas: boolean, pagina: number) {
  const p = new URLSearchParams();
  if (novas) p.set("novas", "1");
  if (pagina > 1) p.set("pagina", String(pagina));
  const texto = p.toString();
  return texto ? `/para-voce?${texto}` : "/para-voce";
}

async function Lista({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const parametros = await searchParams;
  const novas = parametros.novas === "1";
  const pagina = Math.max(1, Math.min(500, Number(parametros.pagina) || 1));

  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const perfil = await obterPerfil(db, organizacaoId);
  if (!perfil || perfil.termos.length === 0) {
    return (
      <EstadoVazio
        icone={Sparkles}
        titulo="Cadastre o ramo da empresa"
        texto="Diga o que a empresa vende, onde atende e quais modalidades interessam. A lista aparece logo em seguida."
        acao={
          <Link href="/inicio/ramo" className="text-sm font-semibold text-accent hover:underline">
            Cadastrar o ramo
          </Link>
        }
      />
    );
  }

  const resultado = await buscarLicitacoes(
    db,
    organizacaoId,
    filtrosDoRamo(perfil, { pagina, novasDesde: novas ? inicioDasNovas() : null }),
  );
  const totalPaginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));
  const agora = new Date();

  return (
    <>
      <div role="group" aria-label="Recortes" className="flex flex-wrap items-center gap-2">
        <FiltroLink rotulo="Novas nas últimas 24 h" ativo={novas} href={href(!novas, 1)} />
        <Link href="/inicio/ramo" className="text-xs font-semibold text-accent hover:underline">
          Ajustar o ramo
        </Link>
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {resultado.total} {resultado.total === 1 ? "licitação combina" : "licitações combinam"} com o seu ramo
        {novas && " e entraram na base nas últimas 24 horas"}
      </p>

      {resultado.linhas.length === 0 ? (
        <EstadoVazio
          icone={SearchX}
          titulo={novas ? "Nada novo nas últimas 24 horas" : "Nenhuma licitação aberta combina com o ramo"}
          texto="Inclua mais termos ou sinônimos no ramo, ou tire alguma UF ou modalidade da lista."
          acao={
            <Link href={novas ? href(false, 1) : "/inicio/ramo"} className="text-sm font-semibold text-accent hover:underline">
              {novas ? "Ver todas" : "Ajustar o ramo"}
            </Link>
          }
        />
      ) : (
        <div>
          <CabecalhoLista />
          <div className="flex flex-col gap-3 md:gap-0">
            {resultado.linhas.map((l) => {
              const aderencia = aderenciaDaLinha(perfil, l);
              return (
                <LinhaLicitacao
                  key={l.numeroControle}
                  agora={agora}
                  acaoAcompanhar={acaoAcompanhar}
                  l={{
                    id: l.numeroControle,
                    href: `/licitacao/${l.cnpj}/${l.ano}/${l.sequencial}`,
                    objeto: l.objeto,
                    orgao: l.orgao,
                    municipio: l.municipio ?? "—",
                    uf: l.uf,
                    modalidade: l.modalidade,
                    valorCentavos: l.valorCentavos,
                    encerramento: l.encerramento,
                    aderencia: aderencia?.nota ?? null,
                    motivos: aderencia?.motivos?.map((m) => m.detalhe),
                    etapaNoFunil: l.etapa && ehEtapa(l.etapa) ? NOME_ETAPA[l.etapa] : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {totalPaginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
          {pagina > 1 ? (
            <Link href={href(novas, pagina - 1)} className="font-semibold text-accent hover:underline">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="num text-muted">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link href={href(novas, pagina + 1)} className="font-semibold text-accent hover:underline">
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
