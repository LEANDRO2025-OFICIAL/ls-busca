import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Download, ExternalLink, FileText, Plus } from "lucide-react";
import { acaoAcompanhar } from "@/app/acoes";
import { Botao, Esqueleto, Selo } from "@/components/ui/basicos";
import { formatarValor, Prazo } from "@/components/ui/licitacao";
import { obterLicitacao } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";
import { historicoDeEtapas } from "@/lib/dados/funil";
import { listarArquivos, type ArquivoPncp } from "@/lib/dados/pncp";
import { ehEtapa, NOME_ETAPA } from "@/lib/etapas";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Licitação" };

type Parametros = Promise<{ cnpj: string; ano: string; seq: string }>;

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function PaginaLicitacao({ params }: { params: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <Link href="/buscar" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Voltar para a busca
      </Link>
      <Suspense fallback={<CarregandoDetalhe />}>
        <Detalhe params={params} />
      </Suspense>
    </main>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted">{rotulo}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

async function Detalhe({ params }: { params: Parametros }) {
  await connection();
  const { cnpj, ano, seq } = await params;
  if (!/^\d{14}$/.test(cnpj) || !/^\d{4}$/.test(ano) || !/^\d{1,9}$/.test(seq)) notFound();

  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const l = await obterLicitacao(db, organizacaoId, cnpj, Number(ano), Number(seq));
  if (!l) notFound();
  const historico = l.etapa ? await historicoDeEtapas(db, organizacaoId, l.numeroControle) : [];
  const nomeEtapa = (e: string | null) => (e && ehEtapa(e) ? NOME_ETAPA[e] : e);

  const agora = new Date();
  const encerrada = l.encerramento != null && l.encerramento.getTime() < agora.getTime();
  const etapa = l.etapa && ehEtapa(l.etapa) ? NOME_ETAPA[l.etapa] : null;
  const data = (d: Date | null) => (d ? formatoDataHora.format(d) : "—");

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Selo>{l.modalidade}</Selo>
          <Selo tom={l.situacao.toLowerCase().includes("divulgada") ? "accent" : "aviso"}>{l.situacao}</Selo>
          {l.srp && <Selo>Registro de preços</Selo>}
          {etapa && <Selo tom="accent">No funil · {etapa}</Selo>}
        </div>
        <h1 className="text-xl font-bold">{l.objeto}</h1>
        <p className="text-sm text-muted">
          {l.orgao}
          {l.unidade && l.unidade !== l.orgao ? ` · ${l.unidade}` : ""} · {l.municipio ?? "—"}/{l.uf}
        </p>
        <Prazo quando={l.encerramento} agora={agora} />
      </header>

      <div className="flex flex-wrap gap-2">
        {etapa ? (
          <Link
            href="/funil"
            className="inline-flex h-10 items-center rounded-md bg-accent-soft px-4 text-sm font-semibold text-accent-strong hover:bg-surface-2"
          >
            Abrir no funil
          </Link>
        ) : (
          <form action={acaoAcompanhar}>
            <input type="hidden" name="numeroControle" value={l.numeroControle} />
            <Botao type="submit" icone={Plus} disabled={encerrada}>
              Acompanhar
            </Botao>
          </form>
        )}
        <a
          href={`https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface"
        >
          Ver no PNCP
          <ExternalLink aria-hidden className="size-4" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        {l.linkOrigem && (
          <a
            href={l.linkOrigem}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface"
          >
            Sistema do órgão
            <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        )}
      </div>

      {historico.length > 0 && (
        <section id="historico" aria-labelledby="titulo-historico" className="flex flex-col gap-2">
          <h2 id="titulo-historico" className="text-base font-semibold">
            Histórico no funil
          </h2>
          <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {historico.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-sm">
                <span className="text-ink">
                  {m.de ? `${nomeEtapa(m.de)} → ` : "Entrou em "}
                  <strong className="font-semibold">{nomeEtapa(m.para)}</strong>
                </span>
                <span className="num text-xs text-muted">
                  {formatoDataHora.format(m.quando)} · {m.responsavel ?? "responsável removido"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section id="edital" aria-labelledby="titulo-edital" className="flex flex-col gap-2">
        <h2 id="titulo-edital" className="text-base font-semibold">
          Edital e anexos
        </h2>
        <Suspense fallback={<Esqueleto className="h-14 w-full" />}>
          <Arquivos cnpj={cnpj} ano={Number(ano)} seq={Number(seq)} linkOrigem={l.linkOrigem} />
        </Suspense>
      </section>

      <dl className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
        <Campo rotulo="Valor estimado">
          <span className="num">{formatarValor(l.valorCentavos)}</span>
        </Campo>
        <Campo rotulo="Modo de disputa">{l.modoDisputa ?? "—"}</Campo>
        <Campo rotulo="Abertura das propostas">
          <span className="num">{data(l.abertura)}</span>
        </Campo>
        <Campo rotulo="Encerramento das propostas">
          <span className="num">{data(l.encerramento)}</span>
        </Campo>
        <Campo rotulo="Publicado no PNCP em">
          <span className="num">{data(l.publicacao)}</span>
        </Campo>
        <Campo rotulo="Processo">{l.processo ?? "—"}</Campo>
        <Campo rotulo="Número da compra">{l.numeroCompra ?? "—"}</Campo>
        <Campo rotulo="Número de controle no PNCP">
          <span className="num font-mono text-xs">{l.numeroControle}</span>
        </Campo>
      </dl>

      {l.informacaoComplementar && (
        <section aria-labelledby="complemento" className="flex flex-col gap-2">
          <h2 id="complemento" className="text-base font-semibold">
            Informação complementar
          </h2>
          <p className="text-sm whitespace-pre-line text-ink">{l.informacaoComplementar}</p>
        </section>
      )}

      <p className="text-xs text-muted">
        Horários convertidos para o horário de Brasília. Confira sempre no edital: o órgão pode ter informado a hora local.
      </p>
    </article>
  );
}

async function Arquivos({ cnpj, ano, seq, linkOrigem }: { cnpj: string; ano: number; seq: number; linkOrigem: string | null }) {
  let arquivos: ArquivoPncp[];
  try {
    arquivos = await listarArquivos(cnpj, ano, seq);
  } catch {
    return (
      <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
        O PNCP não respondeu agora. Recarregue a página em instantes ou use “Ver no PNCP”.
      </p>
    );
  }
  if (arquivos.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-muted">
        O órgão ainda não publicou arquivos no PNCP.
        {linkOrigem ? " Veja no sistema do órgão." : ""}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-bg">
      {arquivos.map((a) => (
        <li key={a.url} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <FileText aria-hidden className="size-4 shrink-0 text-muted" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-ink">{a.titulo}</span>
              <span className="text-xs text-muted">
                {a.tipo}
                {a.publicadoEmISO && ` · publicado em ${formatoDataHora.format(new Date(a.publicadoEmISO))}`}
              </span>
            </span>
          </span>
          <a
            href={a.url}
            rel="noopener noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-3 text-xs font-semibold text-ink hover:bg-surface"
          >
            <Download aria-hidden className="size-4" />
            Baixar<span className="sr-only"> {a.titulo}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function CarregandoDetalhe() {
  return (
    <div aria-busy="true" aria-label="Carregando licitação" className="flex flex-col gap-3">
      <Esqueleto className="h-5 w-40" />
      <Esqueleto className="h-7 w-full" />
      <Esqueleto className="h-4 w-2/3" />
      <Esqueleto className="h-40 w-full" />
    </div>
  );
}
