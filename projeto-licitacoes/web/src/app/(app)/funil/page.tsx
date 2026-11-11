import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Columns3 } from "lucide-react";
import { acaoMoverCartao } from "@/app/acoes";
import { Esqueleto, EstadoVazio } from "@/components/ui/basicos";
import { QuadroFunil } from "@/components/ui/funil";
import { Pipeline } from "@/components/ui/pipeline";
import { cn } from "@/lib/cn";
import { resumirFases } from "@/lib/etapas";
import { obterDb } from "@/lib/dados/db";
import { listarCartoes } from "@/lib/dados/funil";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Funil" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const VISOES = [
  { id: "kanban", nome: "Kanban", href: "/funil" },
  { id: "pipeline", nome: "Pipeline", href: "/funil?visao=pipeline" },
] as const;

export default function PaginaFunil({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="flex w-full min-w-0 flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Funil</h1>
        <p className="text-sm text-muted">
          Seis fases, da descoberta ao contrato. No Kanban, arraste o cartão para outra fase, use o seletor “Mover para”
          ou, com o foco no cartão, as setas ← →. Cada mudança fica salva com data, hora e responsável.
        </p>
      </header>
      <Suspense fallback={<CarregandoQuadro />}>
        <Quadro searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Quadro({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const visao = (await searchParams).visao === "pipeline" ? "pipeline" : "kanban";
  const { organizacaoId } = await exigirOrganizacao();
  const cartoes = await listarCartoes(await obterDb(), organizacaoId);
  const alternador = (
    <nav aria-label="Visão do funil" className="flex w-fit gap-1 rounded-md border border-line bg-surface p-1">
      {VISOES.map((v) => (
        <Link
          key={v.id}
          href={v.href}
          aria-current={v.id === visao ? "page" : undefined}
          className={cn(
            "rounded-sm px-3 py-1 text-sm font-semibold",
            v.id === visao ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          {v.nome}
        </Link>
      ))}
    </nav>
  );

  if (cartoes.length === 0) {
    return (
      <EstadoVazio
        icone={Columns3}
        titulo="Seu funil está vazio"
        texto="Na busca, use “Acompanhar” para trazer uma licitação para a triagem."
        acao={
          <Link href="/buscar" className="text-sm font-semibold text-accent hover:underline">
            Ir para a busca
          </Link>
        }
      />
    );
  }

  if (visao === "pipeline") {
    return (
      <>
        {alternador}
        <Pipeline {...resumirFases(cartoes)} />
      </>
    );
  }

  return (
    <>
      {alternador}
      <QuadroFunil
        agoraISO={new Date().toISOString()}
        aoMover={acaoMoverCartao}
        cartoesIniciais={cartoes.map((c) => ({
          id: c.id,
          objeto: c.objeto,
          orgaoUf: c.orgaoUf,
          etapa: c.etapa,
          prioridade: c.prioridade,
          tags: c.tags,
          prazoISO: c.prazoISO ?? undefined,
          versao: c.versao,
          href: c.href,
        }))}
      />
    </>
  );
}

function CarregandoQuadro() {
  return (
    <div aria-busy="true" aria-label="Carregando funil" className="flex gap-3 overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <Esqueleto key={i} className="h-64 w-coluna shrink-0" />
      ))}
    </div>
  );
}
