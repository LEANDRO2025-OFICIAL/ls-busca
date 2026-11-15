import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BellPlus, SearchX } from "lucide-react";
import { acaoAcompanhar, acaoSalvarBusca } from "@/app/acoes";
import { Botao, Esqueleto, EstadoVazio } from "@/components/ui/basicos";
import { BuscaComTermos, FiltroLink } from "@/components/ui/busca";
import { CabecalhoLista, LinhaLicitacao } from "@/components/ui/licitacao";
import { aderenciaDaLinha, buscarEmTempoReal, buscarLicitacoes, POR_PAGINA, situacaoDaBase } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";
import { listarModalidades, obterPerfil, UFS } from "@/lib/dados/perfil";
import { ehEtapa, NOME_ETAPA } from "@/lib/etapas";
import { CHAVES_SALVAS, lerFiltros, montarHref } from "@/lib/filtros-busca";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Buscar licitações" };

type ParametrosBusca = Promise<Record<string, string | string[] | undefined>>;

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function PaginaBuscar({ searchParams }: { searchParams: ParametrosBusca }) {
  return (
    <main className="mx-auto flex w-full max-w-conteudo flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Buscar licitações</h1>
        <p className="text-sm text-muted">Licitações com proposta em aberto em todo o Brasil, com dados oficiais do PNCP.</p>
      </header>
      <Suspense fallback={<CarregandoResultados />}>
        <Resultados searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Resultados({ searchParams }: { searchParams: ParametrosBusca }) {
  await connection();
  const { q, encerra, ramo, uf, municipio, modalidade, valorMin, valorMax, aderencia, pagina, desde, atuais } = lerFiltros(await searchParams);

  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const perfil = await obterPerfil(db, organizacaoId);
  const temRamo = Boolean(perfil && perfil.termos.length > 0);
  const base = await situacaoDaBase(db);
  const modalidades = await listarModalidades(db);

  const aoVivo = base.abertas === 0;
  const resultado = aoVivo
    ? await buscarEmTempoReal({ q, uf, modalidade, pagina }).catch(() => ({ total: 0, parcial: false, linhas: [] }))
    : await buscarLicitacoes(db, organizacaoId, {
        q,
        uf,
        municipio,
        modalidade,
        valorMinCentavos: valorMin == null ? null : valorMin * 100,
        valorMaxCentavos: valorMax == null ? null : valorMax * 100,
        encerraEmDias: encerra,
        pagina,
        perfil,
        apenasRamo: ramo && temRamo,
        novasDesde: desde,
        aderenciaMin: aderencia,
      });

  const agora = new Date();
  const extras = Object.fromEntries(
    Object.entries(atuais).filter(([chave, valor]) => chave !== "q" && chave !== "desde" && valor),
  );
  const temFiltro = CHAVES_SALVAS.some((chave) => atuais[chave]);
  const totalPaginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));
  const campo = "h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink";

  return (
    <>
      <BuscaComTermos key={q} valorInicial={q} acao="/buscar" extras={extras} />
      <div role="group" aria-label="Recortes" className="flex flex-wrap items-center gap-2">
        {temRamo ? (
          <FiltroLink rotulo="Meu ramo" ativo={ramo} href={montarHref(atuais, { ramo: ramo ? null : "1", pagina: null })} />
        ) : (
          <Link href="/inicio/ramo" className="text-xs font-semibold text-accent hover:underline">
            Cadastre seu ramo para ver o recorte “Meu ramo”
          </Link>
        )}
        <FiltroLink
          rotulo="Encerra em 7 dias"
          ativo={Boolean(encerra)}
          href={montarHref(atuais, { encerra: encerra ? null : "7", pagina: null })}
        />
      </div>

      <form method="get" action="/buscar" aria-label="Filtros" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3">
        {Object.entries({ q, encerra: atuais.encerra, ramo: atuais.ramo })
          .filter(([, v]) => v)
          .map(([nome, valor]) => (
            <input key={nome} type="hidden" name={nome} value={valor} />
          ))}
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          UF
          <select name="uf" defaultValue={uf ?? ""} className={campo}>
            <option value="">Todas</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Município
          <input name="mun" defaultValue={atuais.mun} placeholder="Todos" maxLength={80} className={`${campo} w-40`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Modalidade
          <select name="mod" defaultValue={modalidade ? String(modalidade) : ""} className={`${campo} max-w-56`}>
            <option value="">Todas</option>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Valor mínimo (R$)
          <input name="vmin" inputMode="numeric" defaultValue={atuais.vmin} placeholder="0" className={`${campo} w-32`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Valor máximo (R$)
          <input name="vmax" inputMode="numeric" defaultValue={atuais.vmax} placeholder="sem limite" className={`${campo} w-32`} />
        </label>
        {temRamo && (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Aderência ao ramo
            <select name="ader" defaultValue={aderencia ? String(aderencia) : ""} className={campo}>
              <option value="">Qualquer</option>
              <option value="40">Média ou alta</option>
              <option value="70">Só alta</option>
            </select>
          </label>
        )}
        <Botao type="submit" variante="secundario">
          Aplicar filtros
        </Botao>
        {(uf || municipio || modalidade || valorMin != null || valorMax != null || aderencia) && (
          <Link
            href={montarHref(atuais, { uf: null, mun: null, mod: null, vmin: null, vmax: null, ader: null, pagina: null })}
            className="pb-2 text-sm font-semibold text-accent hover:underline"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        {aoVivo
          ? `${resultado.total} ${resultado.total === 1 ? "resultado" : "resultados"} ao vivo do PNCP`
          : `${resultado.total} ${resultado.total === 1 ? "licitação encontrada" : "licitações encontradas"} de ${base.abertas} abertas`}
        {base.ultimaIngestao && ` · base atualizada em ${formatoDataHora.format(base.ultimaIngestao)}`}
      </p>
      {aoVivo && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-xs text-accent-strong">
          Resultados ao vivo do PNCP · todas as modalidades{" — "}
          <a href="/api/cron/ingerir" className="font-semibold underline">
            popular a base completa
          </a>{" "}
          para buscas ainda mais rápidas.
        </p>
      )}

      {desde && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
          Só as que entraram na base depois de {formatoDataHora.format(desde)}.
          <Link href={montarHref(atuais, { desde: null, pagina: null })} className="font-semibold underline">
            Ver todas
          </Link>
        </p>
      )}

      {temFiltro && (
        <form action={acaoSalvarBusca} className="flex flex-wrap items-end gap-2">
          {CHAVES_SALVAS.map((chave) => atuais[chave] && <input key={chave} type="hidden" name={chave} value={atuais[chave]} />)}
          <div className="flex flex-col gap-1">
            <label htmlFor="nome-busca" className="text-xs font-medium text-muted">
              Salvar esta busca como alerta
            </label>
            <input
              id="nome-busca"
              name="nome"
              required
              maxLength={120}
              defaultValue={q || "Minha busca"}
              className="h-9 w-64 max-w-full rounded-md border border-line-strong bg-bg px-2 text-sm text-ink"
            />
          </div>
          <Botao type="submit" variante="secundario" icone={BellPlus}>
            Salvar alerta
          </Botao>
        </form>
      )}

      {resultado.linhas.length === 0 ? (
        <EstadoVazio
          icone={SearchX}
          titulo={aoVivo ? "Nenhum resultado no PNCP para esse termo" : "Nada encontrado com esses filtros"}
          texto={aoVivo ? "Tente um termo mais geral ou verifique a grafia. Os resultados vêm das 4 principais modalidades do PNCP." : "Tente um termo mais geral, tire uma palavra com hífen ou desligue o recorte de prazo."}
          acao={
            <Link href="/buscar" className="text-sm font-semibold text-accent hover:underline">
              Limpar a busca
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
                  aderencia: aderencia?.pontuacao ?? null,
                  motivos: aderencia?.motivos,
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
            <Link href={montarHref(atuais, { pagina: String(pagina - 1) })} className="font-semibold text-accent hover:underline">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="num text-muted">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link href={montarHref(atuais, { pagina: String(pagina + 1) })} className="font-semibold text-accent hover:underline">
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

function CarregandoResultados() {
  return (
    <div aria-busy="true" aria-label="Carregando licitações" className="flex flex-col gap-3">
      <Esqueleto className="h-11 w-full" />
      <Esqueleto className="h-4 w-60" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line py-3">
          <div className="flex flex-1 flex-col gap-2">
            <Esqueleto className="h-4 w-4/5" />
            <Esqueleto className="h-3 w-2/5" />
          </div>
          <Esqueleto className="h-4 w-24 max-md:hidden" />
          <Esqueleto className="h-4 w-28 max-md:hidden" />
        </div>
      ))}
    </div>
  );
}
