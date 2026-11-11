import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Bell, Briefcase, Building2, CalendarClock, Columns3, FileWarning, FolderOpen, LifeBuoy, Search, Sparkles, Users, type LucideIcon } from "lucide-react";
import { acaoAcompanhar } from "@/app/acoes";
import { Botao, Esqueleto, EstadoVazio, Selo } from "@/components/ui/basicos";
import { CalendarioMes } from "@/components/ui/calendario";
import { CartaoSugerido } from "@/components/ui/cartao-licitacao";
import { formatarValor, formatarValorCompacto, Prazo } from "@/components/ui/licitacao";
import { Indicador, Secao } from "@/components/ui/painel";
import { listarBuscasSalvas } from "@/lib/dados/alertas";
import { aderenciaDaLinha, buscarLicitacoes, filtrosDoRamo } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";
import { resumoDocumentos } from "@/lib/dados/documentos";
import { listarCartoes } from "@/lib/dados/funil";
import { nomeDaOrganizacao, panoramaDaBase, resumoDoFunil } from "@/lib/dados/inicio";
import { obterPerfil } from "@/lib/dados/perfil";
import { listarPrazos } from "@/lib/dados/prazos";
import { ehEtapa, NOME_ETAPA } from "@/lib/etapas";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Início" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const FUSO = "America/Sao_Paulo";
const numero = new Intl.NumberFormat("pt-BR");
const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });
const horaCheia = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", hour12: false });
const diaPorExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });
const FINAIS = new Set(["ganhou", "perdeu", "desistiu"]);

const ATALHOS: { href: string; titulo: string; texto: string; icone: LucideIcon }[] = [
  { href: "/buscar", titulo: "Buscar licitações", texto: "Por objeto, órgão ou processo", icone: Search },
  { href: "/para-voce", titulo: "Para sua empresa", texto: "O que combina com o ramo", icone: Sparkles },
  { href: "/funil", titulo: "Funil", texto: "Cada licitação na sua etapa", icone: Columns3 },
  { href: "/funil/prazos", titulo: "Prazos", texto: "Datas do que você acompanha", icone: CalendarClock },
  { href: "/alertas", titulo: "Alertas", texto: "Buscas salvas e novidades", icone: Bell },
  { href: "/empresa", titulo: "Perfil da empresa", texto: "Nome, CNPJ e porte", icone: Briefcase },
  { href: "/inicio/ramo", titulo: "Ramo da empresa", texto: "O que vende e onde atende", icone: Building2 },
  { href: "/documentos", titulo: "Documentos", texto: "Certidões e validades", icone: FolderOpen },
  { href: "/configuracoes", titulo: "Conta e equipe", texto: "Sua conta e as pessoas", icone: Users },
  { href: "/ajuda", titulo: "Ajuda", texto: "Como usar e guia da lei", icone: LifeBuoy },
];

export default function PaginaInicio({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-conteudo flex-col gap-5 px-4 py-6 md:px-8">
      <Suspense fallback={<Esqueleto className="h-[40rem] w-full" />}>
        <Painel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function saudacao(agora: Date) {
  const hora = Number(horaCheia.format(agora)) % 24;
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

async function Painel({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { mes: mesParam } = await searchParams;
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const agora = new Date();
  const hoje = chaveDia.format(agora);

  // ?mes=AAAA-MM navega no calendário; qualquer outra coisa volta para o mês de hoje.
  const pedido = typeof mesParam === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : hoje.slice(0, 7);
  const [ano, mes] = pedido.split("-").map(Number);

  const empresa = await nomeDaOrganizacao(db, organizacaoId);
  const base = await panoramaDaBase(db);
  const funil = await resumoDoFunil(db, organizacaoId);
  const cartoes = (await listarCartoes(db, organizacaoId)).filter((c) => !FINAIS.has(c.etapa));
  const prazos = await listarPrazos(db, organizacaoId);
  const buscasSalvas = await listarBuscasSalvas(db, organizacaoId);
  const documentos = await resumoDocumentos(db, organizacaoId);
  const perfil = await obterPerfil(db, organizacaoId);
  const ramo = perfil && perfil.termos.length > 0 ? perfil : null;
  const sugeridos = ramo ? await buscarLicitacoes(db, organizacaoId, filtrosDoRamo(ramo)) : null;

  const prazosDeHoje = prazos.filter((p) => p.quando >= agora && chaveDia.format(p.quando) === hoje).length;
  const prazosEm7Dias = prazos.filter((p) => p.quando >= agora && p.quando.getTime() - agora.getTime() <= 7 * 86_400_000).length;

  return (
    <>
      <section className="flex flex-col gap-4 rounded-xl bg-accent p-5 text-on-accent">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {saudacao(agora)}
              {empresa && `, ${empresa}`}
            </h1>
            <p className="text-sm opacity-90">
              {prazosDeHoje === 0
                ? "Nenhum prazo seu vence hoje."
                : `${prazosDeHoje} ${prazosDeHoje === 1 ? "prazo seu vence" : "prazos seus vencem"} hoje.`}
            </p>
            <p className="text-xs capitalize opacity-80">{diaPorExtenso.format(agora)}</p>
          </div>
          <dl className="flex flex-wrap gap-2">
            {[
              { rotulo: "Abertas agora", valor: numero.format(base.abertas) },
              { rotulo: "Encerram hoje", valor: numero.format(base.encerramHoje) },
              { rotulo: "Valor estimado", valor: formatarValorCompacto(base.valorCentavos) },
            ].map((t) => (
              <div key={t.rotulo} className="min-w-28 rounded-lg bg-on-accent/15 px-3 py-2">
                <dd className="num text-xl font-bold">{t.valor}</dd>
                <dt className="text-xs opacity-90">{t.rotulo}</dt>
              </div>
            ))}
          </dl>
        </div>
        <form method="get" action="/buscar" role="search" className="flex flex-wrap gap-2">
          <label htmlFor="busca-inicio" className="sr-only">
            Buscar por objeto, órgão ou processo
          </label>
          <input
            id="busca-inicio"
            name="q"
            type="search"
            placeholder="Buscar por objeto, órgão ou processo (ex.: notebook, merenda escolar)"
            className="h-10 min-w-0 flex-1 basis-64 rounded-md border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted"
          />
          <Botao type="submit" icone={Search}>
            Buscar
          </Botao>
        </form>
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="opacity-90">Publicadas e abertas:</span>
          <span className="num rounded-full bg-on-accent/15 px-2 py-0.5">{numero.format(base.publicadasHoje)} hoje</span>
          <span className="num rounded-full bg-on-accent/15 px-2 py-0.5">{numero.format(base.publicadasSemana)} na semana</span>
          <span className="num rounded-full bg-on-accent/15 px-2 py-0.5">{numero.format(base.publicadasMes)} no mês</span>
        </p>
      </section>

      {(buscasSalvas.length > 0 || documentos.vencidos + documentos.vencendo > 0) && (
        <p className="flex flex-wrap gap-2">
          {buscasSalvas.length > 0 && (
            <Link
              href="/alertas"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-ink hover:border-accent"
            >
              <Bell aria-hidden className="size-4" />
              {buscasSalvas.length} {buscasSalvas.length === 1 ? "alerta salvo" : "alertas salvos"} · ver novidades →
            </Link>
          )}
          {documentos.vencidos + documentos.vencendo > 0 && (
            <Link
              href="/documentos"
              className="inline-flex items-center gap-1.5 rounded-full border border-warning bg-warning-soft px-3 py-1 text-sm font-medium text-warning hover:opacity-90"
            >
              <FileWarning aria-hidden className="size-4" />
              {documentos.vencidos > 0 && `${documentos.vencidos} ${documentos.vencidos === 1 ? "documento vencido" : "documentos vencidos"}`}
              {documentos.vencidos > 0 && documentos.vencendo > 0 && " · "}
              {documentos.vencendo > 0 && `${documentos.vencendo} vencendo em breve`} →
            </Link>
          )}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Secao titulo="Processos em acompanhamento" link={{ href: "/funil", rotulo: "Abrir o funil" }}>
          {cartoes.length === 0 ? (
            <div className="flex flex-col items-start gap-3 text-sm text-muted">
              <p>
                Você ainda não acompanha nenhuma licitação. Ache um edital e clique em <strong className="text-ink">Acompanhar</strong>: ele entra
                no funil com etapa, prazo e valor.
              </p>
              <Link
                href="/buscar"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:opacity-90"
              >
                <Search aria-hidden className="size-4" />
                Buscar licitações
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {cartoes.slice(0, 5).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <Link href={c.href} className="line-clamp-1 text-sm text-ink hover:text-accent hover:underline">
                      {c.objeto}
                    </Link>
                    <p className="line-clamp-1 text-xs text-muted">{c.orgaoUf}</p>
                  </div>
                  <Selo tom="accent">{ehEtapa(c.etapa) ? NOME_ETAPA[c.etapa] : c.etapa}</Selo>
                  <Prazo quando={c.prazoISO ? new Date(c.prazoISO) : null} agora={agora} />
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Calendário" id="calendario" link={{ href: "/funil/prazos", rotulo: "Abrir" }}>
          <CalendarioMes ano={ano} mes={mes} hoje={hoje} eventos={prazos} hrefMes={(a, m) => `/inicio?mes=${a}-${String(m).padStart(2, "0")}#calendario`} />
        </Secao>
      </div>

      <Secao titulo="Resumo do seu funil" link={{ href: "/funil", rotulo: "Análise completa" }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo="Valor a disputar"
            valor={formatarValorCompacto(funil.valorDisputarCentavos)}
            dica={`${funil.paraDisputar} ${funil.paraDisputar === 1 ? "processo" : "processos"} decididos ou em disputa`}
          />
          <Indicador
            rotulo="Em acompanhamento"
            valor={funil.emAndamento}
            dica={formatarValor(funil.valorAndamentoCentavos)}
          />
          <Indicador rotulo="Prazos em 7 dias" valor={prazosEm7Dias} dica="no calendário da empresa" />
          <Indicador rotulo="Ganhos" valor={funil.ganhos} dica={formatarValor(funil.valorGanhoCentavos)} />
        </div>
        {funil.emAndamento === 0 && funil.ganhos === 0 && (
          <p className="text-sm text-muted">Seu funil está vazio. Acompanhe licitações e os números de cada etapa aparecem aqui.</p>
        )}
      </Secao>

      <section aria-labelledby="atalhos" className="flex flex-col gap-3">
        <h2 id="atalhos" className="text-base font-semibold">
          Acesso rápido
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ATALHOS.map(({ href, titulo, texto, icone: Icone }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full items-center gap-3 rounded-lg border border-line bg-bg p-3 shadow-card hover:border-accent"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong">
                  <Icone aria-hidden className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{titulo}</span>
                  <span className="block text-xs text-muted">{texto}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sugeridos" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="sugeridos" className="text-base font-semibold">
              Sugeridos para a sua empresa
            </h2>
            <p className="text-xs text-muted">Combinam com o seu ramo; os que mais combinam vêm primeiro.</p>
          </div>
          {sugeridos && sugeridos.total > 0 && (
            <Link href="/para-voce" className="text-xs font-semibold text-accent hover:underline">
              Ver os {numero.format(sugeridos.total)} sugeridos
            </Link>
          )}
        </div>
        {!ramo ? (
          <EstadoVazio
            icone={Sparkles}
            titulo="Cadastre o ramo da empresa"
            texto="Diga o que a empresa vende e onde atende. As sugestões aparecem logo em seguida."
            acao={
              <Link href="/inicio/ramo" className="text-sm font-semibold text-accent hover:underline">
                Cadastrar o ramo
              </Link>
            }
          />
        ) : sugeridos && sugeridos.linhas.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sugeridos.linhas.slice(0, 6).map((l) => {
              const aderencia = aderenciaDaLinha(ramo, l);
              return (
                <CartaoSugerido
                  key={l.numeroControle}
                  agora={agora}
                  publicacao={l.publicacao}
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
                    aderencia: aderencia?.pontuacao ?? null,
                    motivos: aderencia?.motivos,
                    etapaNoFunil: l.etapa && ehEtapa(l.etapa) ? NOME_ETAPA[l.etapa] : undefined,
                  }}
                />
              );
            })}
          </div>
        ) : (
          <EstadoVazio
            icone={Sparkles}
            titulo="Nada aberto no seu ramo agora"
            texto="Inclua mais termos ou sinônimos no ramo."
            acao={
              <Link href="/inicio/ramo" className="text-sm font-semibold text-accent hover:underline">
                Ajustar o ramo
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}
