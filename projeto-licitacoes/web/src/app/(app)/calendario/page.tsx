import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Esqueleto } from "@/components/ui/basicos";
import {
  agruparPorDia,
  diaDeBrasilia,
  diasDaSemana,
  lerDia,
  NOME_TIPO_PRAZO,
  semanasDoMes,
  somarDias,
  somarMeses,
  tipoDoPrazo,
  TIPOS_PRAZO,
  type TipoPrazo,
} from "@/lib/agenda";
import { cn } from "@/lib/cn";
import { obterDb } from "@/lib/dados/db";
import { listarPrazos, type PrazoDoBanco } from "@/lib/dados/prazos";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Calendário de prazos" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;
type Visao = "mes" | "semana";

/** Cor de cada tipo (tokens do tema); o nome do tipo sempre acompanha, na legenda e no texto do evento. */
const COR_TIPO: Record<TipoPrazo, string> = {
  proposta: "bg-accent-soft text-accent-strong",
  sessao: "bg-warning-soft text-warning",
  recurso: "bg-danger-soft text-danger",
  outros: "bg-surface-2 text-ink",
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const meioDia = (dia: string) => new Date(`${dia}T12:00:00Z`);
const formatoMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" });
const formatoDiaLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const formatoHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

const href = (visao: Visao, data: string) => `/calendario?visao=${visao}&data=${data}`;
const botaoNavegar = "inline-flex size-8 items-center justify-center rounded-md border border-line-strong bg-bg text-ink hover:bg-surface-2";

export default function PaginaCalendario({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Calendário de prazos</h1>
          <p className="text-sm text-muted">
            Prazos das licitações que você acompanha, no horário de Brasília. Clique em um prazo para abrir a licitação.
          </p>
        </div>
        <a
          href="/calendario/exportar"
          download
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-bg px-3 text-sm font-semibold text-ink hover:bg-surface-2"
        >
          <Download aria-hidden className="size-4" />
          Exportar .ics
        </a>
      </header>
      <Suspense fallback={<Esqueleto className="h-[32rem] w-full" />}>
        <Calendario searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Evento({ p, completo = false }: { p: PrazoDoBanco; completo?: boolean }) {
  const tipo = tipoDoPrazo(p);
  return (
    <Link
      href={p.href}
      title={`${NOME_TIPO_PRAZO[tipo]} · ${formatoHora.format(p.quando)} · ${p.titulo} · ${p.objeto}`}
      className={cn("block rounded-sm px-1.5 py-1 text-xs leading-tight hover:opacity-80", !completo && "truncate", COR_TIPO[tipo])}
    >
      <span className="sr-only">{NOME_TIPO_PRAZO[tipo]}: </span>
      <span className="num font-semibold">{formatoHora.format(p.quando)}</span>{" "}
      {completo ? (
        <>
          <span className="font-semibold">{p.titulo}</span>
          <span className="mt-0.5 line-clamp-3 block">{p.objeto}</span>
        </>
      ) : (
        p.objeto
      )}
    </Link>
  );
}

async function Calendario({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const parametros = await searchParams;
  const visao: Visao = parametros.visao === "semana" ? "semana" : "mes";
  const hoje = diaDeBrasilia(new Date());
  const data = lerDia(typeof parametros.data === "string" ? parametros.data : undefined) ?? hoje;
  const { organizacaoId } = await exigirOrganizacao();
  const prazos = await listarPrazos(await obterDb(), organizacaoId);
  const porDia = agruparPorDia(prazos);

  const semana = diasDaSemana(data);
  const titulo =
    visao === "mes" ? formatoMes.format(meioDia(data)) : `${formatoDia.format(meioDia(semana[0]))} a ${formatoDia.format(meioDia(semana[6]))}`;
  const anterior = visao === "mes" ? somarMeses(data, -1) : somarDias(data, -7);
  const proximo = visao === "mes" ? somarMeses(data, 1) : somarDias(data, 7);
  const mesAtual = data.slice(0, 7);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href(visao, anterior)} className={botaoNavegar}>
            <ChevronLeft aria-hidden className="size-4" />
            <span className="sr-only">{visao === "mes" ? "Mês anterior" : "Semana anterior"}</span>
          </Link>
          <Link href={href(visao, proximo)} className={botaoNavegar}>
            <ChevronRight aria-hidden className="size-4" />
            <span className="sr-only">{visao === "mes" ? "Próximo mês" : "Próxima semana"}</span>
          </Link>
          <Link href={href(visao, hoje)} className="inline-flex h-8 items-center rounded-md border border-line-strong bg-bg px-3 text-sm font-semibold text-ink hover:bg-surface-2">
            Hoje
          </Link>
          <h2 className="ml-1 text-base font-semibold first-letter:uppercase" aria-live="polite">
            {titulo}
          </h2>
        </div>
        <nav aria-label="Visão do calendário" className="flex gap-1 rounded-md border border-line bg-surface p-1">
          {(["mes", "semana"] as const).map((v) => (
            <Link
              key={v}
              href={href(v, data)}
              aria-current={v === visao ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-1 text-sm font-semibold",
                v === visao ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {v === "mes" ? "Mês" : "Semana"}
            </Link>
          ))}
        </nav>
      </div>

      <ul aria-label="Legenda dos tipos de prazo" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {TIPOS_PRAZO.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("inline-block size-3 rounded-sm border border-line", COR_TIPO[t])} />
            {NOME_TIPO_PRAZO[t]}
          </li>
        ))}
      </ul>

      {visao === "mes" ? (
        <div className="relative overflow-x-auto">
          <div className="min-w-[44rem] overflow-hidden rounded-lg border border-line bg-bg">
            <div aria-hidden className="grid grid-cols-7 border-b border-line bg-surface text-center text-xs font-semibold text-muted">
              {DIAS.map((d) => (
                <span key={d} className="py-1.5">
                  {d}
                </span>
              ))}
            </div>
            <ol className="grid grid-cols-7">
              {semanasDoMes(data)
                .flat()
                .map((dia) => {
                  const eventos = porDia.get(dia) ?? [];
                  const fora = dia.slice(0, 7) !== mesAtual;
                  return (
                    <li
                      key={dia}
                      aria-label={`${formatoDiaLongo.format(meioDia(dia))}${dia === hoje ? ", hoje" : ""}, ${eventos.length} ${eventos.length === 1 ? "prazo" : "prazos"}`}
                      className={cn("flex min-h-28 flex-col gap-1 border-r border-b border-line p-1 [&:nth-child(7n)]:border-r-0", fora && "bg-surface")}
                    >
                      <span
                        className={cn(
                          "num flex size-6 items-center justify-center self-end rounded-full text-xs",
                          dia === hoje ? "bg-accent font-semibold text-on-accent" : fora ? "text-muted" : "text-ink",
                        )}
                      >
                        {Number(dia.slice(8))}
                      </span>
                      {eventos.slice(0, 3).map((p) => (
                        <Evento key={p.id} p={p} />
                      ))}
                      {eventos.length > 3 && (
                        <Link href={href("semana", dia)} className="px-1.5 text-xs font-semibold text-accent hover:underline">
                          +{eventos.length - 3} na semana
                        </Link>
                      )}
                    </li>
                  );
                })}
            </ol>
          </div>
        </div>
      ) : (
        <ol className="grid gap-2 md:grid-cols-7">
          {semana.map((dia, i) => {
            const eventos = porDia.get(dia) ?? [];
            return (
              <li
                key={dia}
                aria-label={`${formatoDiaLongo.format(meioDia(dia))}${dia === hoje ? ", hoje" : ""}`}
                className="flex flex-col gap-1.5 rounded-lg border border-line bg-bg p-2 md:min-h-80"
              >
                <p className={cn("flex items-baseline gap-1.5 text-xs font-semibold", dia === hoje ? "text-accent-strong" : "text-muted")}>
                  {DIAS[i]}
                  <span className={cn("num rounded-full px-1.5 text-sm", dia === hoje ? "bg-accent text-on-accent" : "text-ink")}>
                    {Number(dia.slice(8))}
                  </span>
                </p>
                {eventos.length === 0 ? (
                  <p className="text-xs text-muted">Sem prazos</p>
                ) : (
                  eventos.map((p) => <Evento key={p.id} p={p} completo />)
                )}
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs text-muted">
        Mostra o fim do envio de propostas (PNCP), o prazo da etapa e os prazos criados pela equipe em{" "}
        <Link href="/funil/prazos" className="font-semibold text-accent hover:underline">
          Prazos
        </Link>
        . O tipo de um prazo da equipe vem do título (por exemplo, “Sessão pública” ou “Recurso”).
      </p>
    </>
  );
}
