import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Columns3 } from "lucide-react";
import { acaoMoverCartao } from "@/app/acoes";
import { Esqueleto, EstadoVazio } from "@/components/ui/basicos";
import { QuadroFunil } from "@/components/ui/funil";
import { obterDb } from "@/lib/dados/db";
import { listarCartoes } from "@/lib/dados/funil";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Funil" };

export default function PaginaFunil() {
  return (
    <main className="flex w-full min-w-0 flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Funil</h1>
        <p className="text-sm text-muted">
          Mude a etapa pelo seletor “Mover para” ou com o foco no cartão e as setas ← →. A mudança fica salva.
        </p>
      </header>
      <Suspense fallback={<CarregandoQuadro />}>
        <Quadro />
      </Suspense>
    </main>
  );
}

async function Quadro() {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const cartoes = await listarCartoes(await obterDb(), organizacaoId);

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

  return (
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
