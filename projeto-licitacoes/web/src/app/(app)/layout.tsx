import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { acaoSair } from "@/app/acoes-auth";
import { Acessibilidade } from "@/components/ui/acessibilidade";
import { ProvedorAvisos } from "@/components/ui/avisos";
import { BuscaUniversal } from "@/components/ui/busca-universal";
import { Navegacao } from "@/components/ui/navegacao";
import { NavegacaoApp } from "@/components/ui/navegacao-app";
import { Sino } from "@/components/ui/sino";
import { AlternarTema } from "@/components/ui/tema";
import { buscarLicitacoes, filtrosDoRamo, inicioDasNovas } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";
import { obterPerfil } from "@/lib/dados/perfil";
import { exigirOrganizacao } from "@/lib/sessao";

const ATALHOS_CELULAR = [
  { href: "/inicio", rotulo: "Início" },
  { href: "/visao-geral", rotulo: "Visão geral" },
  { href: "/para-voce", rotulo: "Para sua empresa" },
  { href: "/buscar", rotulo: "Buscar" },
  { href: "/funil", rotulo: "Funil" },
  { href: "/funil/prazos", rotulo: "Prazos" },
  { href: "/calendario", rotulo: "Calendário" },
  { href: "/alertas", rotulo: "Alertas" },
  { href: "/comunidade", rotulo: "Grandes licitações" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/empresa", rotulo: "Empresa" },
  { href: "/ajuda", rotulo: "Ajuda" },
];

export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <ProvedorAvisos>
      <div className="flex min-h-screen">
        <div className="sticky top-0 h-screen shrink-0 max-lg:hidden">
          <Suspense fallback={<Navegacao atual="" />}>
            <NavegacaoComContagem />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <nav aria-label="Principal" className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-2 lg:hidden">
            {ATALHOS_CELULAR.map((a) => (
              <Link key={a.href} href={a.href} className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-ink transition-colors hover:bg-surface-2">
                {a.rotulo}
              </Link>
            ))}
            <form action={acaoSair} className="ml-auto">
              <button type="submit" className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-ink transition-colors hover:bg-surface-2">
                Sair
              </button>
            </form>
          </nav>
          <div className="flex items-center justify-end gap-2 border-b border-line bg-bg px-4 py-2">
            <BuscaUniversal />
            <Suspense fallback={<span aria-hidden className="size-9" />}>
              <Sino />
            </Suspense>
            <AlternarTema />
            <Acessibilidade />
          </div>
          {children}
        </div>
      </div>
    </ProvedorAvisos>
  );
}

/** Menu com o selo de novas do "Para sua empresa" (o layout não re-renderiza na navegação, então conta só ao carregar). */
async function NavegacaoComContagem() {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const perfil = await obterPerfil(db, organizacaoId);
  const novas =
    perfil && perfil.termos.length > 0
      ? (await buscarLicitacoes(db, organizacaoId, filtrosDoRamo(perfil, { novasDesde: inicioDasNovas() }))).total
      : 0;
  return <NavegacaoApp novasParaVoce={novas} />;
}
