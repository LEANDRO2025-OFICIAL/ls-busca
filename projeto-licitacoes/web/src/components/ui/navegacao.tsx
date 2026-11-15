import Link from "next/link";
import {
  Bell,
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Columns3,
  FileSignature,
  FileStack,
  FolderOpen,
  House,
  Landmark,
  LifeBuoy,
  LogOut,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { acaoSair } from "@/app/acoes-auth";
import { cn } from "@/lib/cn";

type Item = { href: string; rotulo: string; icone: LucideIcon };
type Grupo = { titulo: string | null; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    titulo: null,
    itens: [
      { href: "/inicio", rotulo: "Início", icone: House },
      { href: "/visao-geral", rotulo: "Visão geral", icone: ChartColumn },
    ],
  },
  {
    titulo: "Encontrar",
    itens: [
      { href: "/buscar", rotulo: "Buscar", icone: Search },
      { href: "/para-voce", rotulo: "Para sua empresa", icone: Sparkles },
      { href: "/alertas", rotulo: "Alertas", icone: Bell },
      { href: "/comunidade", rotulo: "Grandes licitações", icone: Landmark },
    ],
  },
  {
    titulo: "Minha empresa",
    itens: [
      { href: "/funil", rotulo: "Funil", icone: Columns3 },
      { href: "/funil/prazos", rotulo: "Prazos", icone: CalendarClock },
      { href: "/calendario", rotulo: "Calendário", icone: CalendarDays },
      { href: "/robo", rotulo: "Robô de lance", icone: Bot },
      { href: "/empresa", rotulo: "Perfil da empresa", icone: Briefcase },
      { href: "/inicio/ramo", rotulo: "Ramo da empresa", icone: Building2 },
      { href: "/documentos", rotulo: "Documentos", icone: FolderOpen },
      { href: "/contratos", rotulo: "Contratos e ATAs", icone: FileStack },
      { href: "/declaracoes", rotulo: "Declarações", icone: FileSignature },
      { href: "/configuracoes", rotulo: "Conta e equipe", icone: Users },
    ],
  },
  { titulo: null, itens: [{ href: "/ajuda", rotulo: "Ajuda", icone: LifeBuoy }] },
];

/** novasParaVoce: selo no item "Para sua empresa" (licitações do ramo que entraram nas últimas 24 h). */
export function Navegacao({ atual, novasParaVoce = 0 }: { atual: string; novasParaVoce?: number }) {
  return (
    <nav aria-label="Principal" className="flex h-full w-sidebar flex-col gap-1 border-r border-line bg-surface p-3">
      <p className="mb-4 px-2 pt-1 text-sm font-bold text-ink">
        LS Busca
      </p>
      <div className="flex flex-col gap-4">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo ?? "geral"}>
            {grupo.titulo && (
              <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{grupo.titulo}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {grupo.itens.map(({ href, rotulo, icone: Icone }) => {
                const ativo = href === atual;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                        ativo
                          ? "bg-accent-soft font-semibold text-accent-strong before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
                          : "text-ink hover:bg-surface-2",
                      )}
                    >
                      <Icone aria-hidden className="size-4" />
                      {rotulo}
                      {href === "/para-voce" && novasParaVoce > 0 && (
                        <span className="num ml-auto rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
                          {novasParaVoce > 99 ? "99+" : novasParaVoce}
                          <span className="sr-only"> novas</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <form action={acaoSair} className="mt-auto">
        <button
          type="submit"
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm text-ink transition-colors hover:bg-surface-2"
        >
          <LogOut aria-hidden className="size-4" />
          Sair
        </button>
      </form>
    </nav>
  );
}
