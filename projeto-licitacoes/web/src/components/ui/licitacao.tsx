import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarX, Clock, FileText, Landmark, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { faixaAderencia, type Faixa } from "@/lib/aderencia";
import { Botao, EstadoVazio, Selo, type TomSelo } from "./basicos";

// Componentes sem estado: servem tanto em Server quanto em Client Components.
// "agora" vem sempre por parâmetro para o HTML do servidor e do cliente baterem.

const FUSO = "America/Sao_Paulo";
const DIA_MS = 86_400_000;
const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const formatoHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });
const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoChave = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });

/** Dia civil em Brasília, no formato AAAA-MM-DD. */
function chaveDia(data: Date) {
  return formatoChave.format(data);
}

export function formatarValor(centavos: number | null) {
  return centavos == null ? "Não informado" : formatoMoeda.format(centavos / 100);
}

const formatoCompacto = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Valores grandes em forma curta: R$ 471,16 bi, R$ 3,2 mi. Abaixo de 1 milhão, o valor inteiro. */
export function formatarValorCompacto(centavos: number) {
  const reais = centavos / 100;
  if (reais >= 1e9) return `R$ ${formatoCompacto.format(reais / 1e9)} bi`;
  if (reais >= 1e6) return `R$ ${formatoCompacto.format(reais / 1e6)} mi`;
  return formatoMoeda.format(reais);
}

export function Prazo({ quando, agora }: { quando: Date | null; agora: Date }) {
  if (!quando) return <span className="text-sm text-muted">—</span>;

  const vencido = quando.getTime() < agora.getTime();
  const dias = Math.round((Date.parse(chaveDia(quando)) - Date.parse(chaveDia(agora))) / DIA_MS);
  const completo = formatoDataHora.format(quando);

  let texto: string;
  let estilo: string;
  if (vencido) {
    texto = "Encerrada";
    estilo = "text-danger";
  } else if (dias === 0) {
    texto = `Encerra hoje, ${formatoHora.format(quando)}`;
    estilo = "rounded-sm bg-warning-soft px-1.5 font-semibold text-warning";
  } else if (dias <= 3) {
    texto = dias === 1 ? "Encerra amanhã" : `Encerra em ${dias} dias`;
    estilo = "font-medium text-warning";
  } else {
    texto = `Encerra em ${dias} dias`;
    estilo = "text-muted";
  }

  return (
    <time
      dateTime={quando.toISOString()}
      title={completo}
      className={cn("num inline-flex items-center gap-1 text-sm whitespace-nowrap", estilo)}
    >
      {!vencido && dias <= 3 && <Clock aria-hidden className="size-3.5" />}
      {texto}
      <span className="sr-only">, {completo}</span>
    </time>
  );
}

const FAIXAS: Record<Faixa, { nome: string; barra: string; texto: string }> = {
  alta: { nome: "Alta", barra: "bg-success", texto: "text-success" },
  media: { nome: "Média", barra: "bg-warning", texto: "text-warning" },
  baixa: { nome: "Baixa", barra: "bg-muted", texto: "text-muted" },
  "sem-perfil": { nome: "Sem ramo", barra: "bg-surface-2", texto: "text-muted" },
};

export function MedidorAderencia({ pontuacao, motivos = [] }: { pontuacao: number | null; motivos?: string[] }) {
  if (pontuacao == null) {
    return (
      <Link href="/inicio/ramo" className="text-xs font-medium text-accent underline-offset-2 hover:underline">
        Cadastrar ramo
      </Link>
    );
  }
  const faixa = FAIXAS[faixaAderencia(pontuacao)];
  const cheios = Math.ceil(pontuacao / 20);
  return (
    <span className="inline-flex items-center">
      <span
        role="meter"
        aria-label="Aderência ao ramo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pontuacao}
        aria-valuetext={`${faixa.nome}, ${pontuacao} de 100`}
        title={motivos.join(" · ") || undefined}
        className="inline-flex items-center gap-2"
      >
        <span aria-hidden className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={cn("h-2 w-3 rounded-[2px]", i < cheios ? faixa.barra : "bg-surface-2")} />
          ))}
        </span>
        <span aria-hidden className={cn("text-xs font-semibold", faixa.texto)}>
          {faixa.nome}
        </span>
      </span>
      {motivos.length > 0 && <span className="sr-only">. Motivos: {motivos.join("; ")}</span>}
    </span>
  );
}

export type LicitacaoResumo = {
  id: string;
  href: string;
  objeto: string;
  orgao: string;
  municipio: string;
  uf: string;
  modalidade: string;
  valorCentavos: number | null;
  encerramento: Date | null;
  aderencia: number | null;
  motivos?: string[];
  etapaNoFunil?: string;
};

const COLUNAS_LISTA = "md:grid-cols-[minmax(0,1fr)_10rem_11rem_7rem_8.5rem]";

export function CabecalhoLista() {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden border-b border-line px-4 pb-2 text-xs font-semibold tracking-wide text-muted uppercase md:grid md:gap-3",
        COLUNAS_LISTA,
      )}
    >
      <span>Objeto</span>
      <span>Valor estimado</span>
      <span>Prazo</span>
      <span>Aderência</span>
      <span className="justify-self-end">Ação</span>
    </div>
  );
}

export function LinhaLicitacao({
  l,
  agora,
  acaoAcompanhar,
}: {
  l: LicitacaoResumo;
  agora: Date;
  /** Server Action que recebe FormData com "numeroControle" (= l.id). Sem ela, o botão só demonstra. */
  acaoAcompanhar?: (formData: FormData) => Promise<void>;
}) {
  const encerrada = l.encerramento != null && l.encerramento.getTime() < agora.getTime();
  return (
    <article
      className={cn(
        "grid gap-3 bg-bg p-4 md:items-center md:gap-3 md:border-b md:border-line md:px-4 md:py-3 md:hover:bg-surface",
        "max-md:rounded-lg max-md:border max-md:border-line max-md:shadow-card",
        COLUNAS_LISTA,
        encerrada && "opacity-70",
      )}
    >
      <div className="min-w-0">
        <Link href={l.href} className="line-clamp-2 text-sm font-medium text-ink hover:text-accent hover:underline">
          {l.objeto}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Landmark aria-hidden className="size-3.5" />
            {l.orgao}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-3.5" />
            {l.municipio}/{l.uf}
          </span>
          <Selo>{l.modalidade}</Selo>
          {l.etapaNoFunil && <Selo tom="accent">No funil · {l.etapaNoFunil}</Selo>}
          <Link href={`${l.href}#edital`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            <FileText aria-hidden className="size-3.5" />
            Edital e anexos
          </Link>
        </p>
      </div>
      <p className="num text-sm text-ink">
        <span className="text-xs text-muted md:sr-only">Valor estimado: </span>
        {formatarValor(l.valorCentavos)}
      </p>
      <Prazo quando={l.encerramento} agora={agora} />
      <MedidorAderencia pontuacao={l.aderencia} motivos={l.motivos} />
      <div className="md:justify-self-end">
        {l.etapaNoFunil ? (
          <Link
            href="/funil"
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-soft"
          >
            Abrir no funil
          </Link>
        ) : acaoAcompanhar ? (
          <form action={acaoAcompanhar}>
            <input type="hidden" name="numeroControle" value={l.id} />
            <Botao type="submit" variante="secundario" tamanho="sm" icone={Plus} disabled={encerrada}>
              Acompanhar
            </Botao>
          </form>
        ) : (
          <Botao variante="secundario" tamanho="sm" icone={Plus} disabled={encerrada}>
            Acompanhar
          </Botao>
        )}
      </div>
    </article>
  );
}

export type EventoPrazo = {
  id: string;
  titulo: string;
  quando: Date;
  tipo: "abertura" | "encerramento" | "manual";
  /** Licitação do evento: linha clicável e o objeto embaixo do título. */
  href?: string;
  detalhe?: string;
  acao?: ReactNode;
};

const TIPO_EVENTO: Record<EventoPrazo["tipo"], { nome: string; tom: TomSelo }> = {
  abertura: { nome: "Abertura", tom: "accent" },
  encerramento: { nome: "Encerramento", tom: "aviso" },
  manual: { nome: "Prazo interno", tom: "neutro" },
};

/** Visão em lista do calendário de prazos (padrão no celular). */
export function ListaPrazos({ eventos, agora }: { eventos: EventoPrazo[]; agora: Date }) {
  if (eventos.length === 0) {
    return (
      <EstadoVazio
        icone={CalendarX}
        titulo="Sem prazos à vista"
        texto="Quando você acompanhar uma licitação, as datas dela aparecem aqui."
      />
    );
  }

  const grupos = new Map<string, EventoPrazo[]>();
  for (const e of [...eventos].sort((a, b) => a.quando.getTime() - b.quando.getTime())) {
    const chave = chaveDia(e.quando);
    grupos.set(chave, [...(grupos.get(chave) ?? []), e]);
  }
  const hoje = chaveDia(agora);

  return (
    <ol className="flex flex-col gap-4">
      {[...grupos].map(([dia, lista]) => (
        <li key={dia}>
          <h3
            className={cn(
              "mb-2 text-xs font-semibold tracking-wide uppercase",
              dia === hoje ? "text-accent" : "text-muted",
            )}
          >
            {dia === hoje && "Hoje · "}
            {formatoDia.format(lista[0].quando)}
          </h3>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-bg">
            {lista.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex min-w-0 flex-col">
                  {e.href ? (
                    <Link href={e.href} className="truncate text-ink hover:text-accent hover:underline">
                      {e.titulo}
                    </Link>
                  ) : (
                    <span className="truncate text-ink">{e.titulo}</span>
                  )}
                  {e.detalhe && <span className="truncate text-xs text-muted">{e.detalhe}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Selo tom={TIPO_EVENTO[e.tipo].tom}>{TIPO_EVENTO[e.tipo].nome}</Selo>
                  <time dateTime={e.quando.toISOString()} className="num text-muted">
                    {formatoHora.format(e.quando)}
                  </time>
                  {e.acao}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
