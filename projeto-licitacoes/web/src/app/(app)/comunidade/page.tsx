import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Check, Pause, Pencil, Play, SearchX, Trash2 } from "lucide-react";
import { acaoAcompanhar, acaoDefinirAlertaAtivo, acaoMarcarBuscaVista, acaoRemoverBusca } from "@/app/acoes";
import { FormularioAlerta, ListaAvisos, resumoDoAlerta } from "@/components/ui/alertas";
import { Alerta, Botao, Esqueleto, EstadoVazio, Selo } from "@/components/ui/basicos";
import { CabecalhoLista, formatarValor, LinhaLicitacao } from "@/components/ui/licitacao";
import { lerLimiteComunidade } from "@/lib/casamento";
import { listarAvisos, listarBuscasSalvas } from "@/lib/dados/alertas";
import { buscarLicitacoes, POR_PAGINA } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";
import { listarModalidades, UFS } from "@/lib/dados/perfil";
import { ehEtapa, NOME_ETAPA } from "@/lib/etapas";
import { lerFiltros } from "@/lib/filtros-busca";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Grandes licitações" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const campo = "h-9 rounded-md border border-line-strong bg-bg px-2 text-sm text-ink";
const linkAcao = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-soft";

export default function PaginaComunidade({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Grandes licitações</h1>
        <p className="text-sm text-muted">
          Mural interno das licitações de maior valor com proposta em aberto. Cadastre seus interesses para ser avisado
          quando entrar uma que casa com eles.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function hrefMural(atuais: Record<string, string>, mudanca: Record<string, string | null> = {}) {
  const parametros = new URLSearchParams();
  for (const chave of ["uf", "mun", "mod", "vmin", "pagina"]) {
    const valor = chave in mudanca ? mudanca[chave] : atuais[chave];
    if (valor) parametros.set(chave, valor);
  }
  const texto = parametros.toString();
  return texto ? `/comunidade?${texto}` : "/comunidade";
}

async function Conteudo({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const bruto = await searchParams;
  const { editar, erro, ok } = bruto;
  const { uf, municipio, modalidade, valorMin, pagina, atuais } = lerFiltros(bruto);
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const db = await obterDb();
  const limite = lerLimiteComunidade(process.env.COMUNIDADE_VALOR_MINIMO);
  const textoLimite = formatarValor(limite);
  const agora = new Date();

  const modalidades = await listarModalidades(db);
  const nomesModalidade = new Map(modalidades.map((m) => [m.id, m.nome]));
  const mural = await buscarLicitacoes(db, organizacaoId, {
    q: "",
    uf,
    municipio,
    modalidade,
    // O filtro só sobe o piso do mural; nunca desce.
    valorMinCentavos: Math.max(limite, valorMin == null ? 0 : valorMin * 100),
    valorMaxCentavos: null,
    encerraEmDias: null,
    pagina,
    perfil: null,
    apenasRamo: false,
  });
  const totalPaginas = Math.ceil(mural.total / POR_PAGINA);
  const interesses = await listarBuscasSalvas(db, organizacaoId, { tipo: "comunidade", usuarioId });
  const emEdicao = interesses.find((i) => i.id === editar);
  const avisos = await listarAvisos(db, organizacaoId, { tipo: "comunidade", usuarioId, limite: 50 });
  const temFiltro = Boolean(uf || municipio || modalidade || valorMin != null);

  return (
    <>
      {erro === "dados" && <Alerta>Dê um nome ao interesse.</Alerta>}
      {(ok === "criado" || ok === "editado") && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {ok === "criado" ? "Interesse cadastrado. Você será avisado das próximas grandes licitações que casarem." : "Interesse atualizado."}
        </p>
      )}

      <section aria-labelledby="titulo-mural" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-mural" className="text-base font-semibold">
            Mural
          </h2>
          <p className="text-xs text-muted">
            Valor estimado a partir de <span className="num">{textoLimite}</span> ·{" "}
            <span className="num">{mural.total}</span> {mural.total === 1 ? "licitação" : "licitações"}
          </p>
        </div>
        <form action="/comunidade" className="flex flex-wrap items-end gap-3">
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
            <input name="vmin" inputMode="numeric" defaultValue={atuais.vmin} placeholder={String(limite / 100)} className={`${campo} num w-36`} />
          </label>
          <Botao type="submit" variante="secundario">
            Aplicar filtros
          </Botao>
          {temFiltro && (
            <Link href="/comunidade" className="pb-2 text-sm font-semibold text-accent hover:underline">
              Limpar filtros
            </Link>
          )}
        </form>

        {mural.linhas.length === 0 ? (
          <EstadoVazio
            icone={SearchX}
            titulo="Nenhuma grande licitação em aberto"
            texto={
              temFiltro
                ? "Nada casa com estes filtros agora. Tente ampliar a região ou baixar o valor mínimo."
                : `Quando a base receber licitações a partir de ${textoLimite}, elas aparecem aqui.`
            }
          />
        ) : (
          <div>
            <CabecalhoLista />
            <div className="flex flex-col gap-3 md:gap-0">
              {mural.linhas.map((l) => (
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
                    aderencia: null,
                    etapaNoFunil: l.etapa && ehEtapa(l.etapa) ? NOME_ETAPA[l.etapa] : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {totalPaginas > 1 && (
          <nav aria-label="Paginação do mural" className="flex items-center justify-between gap-3 text-sm">
            {pagina > 1 ? (
              <Link href={hrefMural(atuais, { pagina: String(pagina - 1) })} className="font-semibold text-accent hover:underline">
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="num text-muted">
              Página {pagina} de {totalPaginas}
            </span>
            {pagina < totalPaginas ? (
              <Link href={hrefMural(atuais, { pagina: String(pagina + 1) })} className="font-semibold text-accent hover:underline">
                Próxima →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>

      <section id="interesses" aria-labelledby="titulo-interesses" className="flex flex-col gap-3">
        <div>
          <h2 id="titulo-interesses" className="text-base font-semibold">
            Meus interesses
          </h2>
          <p className="text-xs text-muted">
            São seus: cada pessoa da equipe cadastra os próprios. O aviso chega aqui e no sino, uma vez por licitação.
          </p>
        </div>

        {emEdicao ? (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <h3 className="text-sm font-semibold">Editar interesse</h3>
            <FormularioAlerta
              tipo="comunidade"
              alerta={emEdicao}
              modalidades={modalidades}
              rotuloEnviar="Salvar alterações"
              dicaValorMinimo={`Nunca abaixo de ${textoLimite}.`}
            />
          </div>
        ) : (
          <details className="rounded-lg border border-line bg-surface p-4" open={interesses.length === 0 || erro === "dados"}>
            <summary className="cursor-pointer text-sm font-semibold text-ink">Novo interesse</summary>
            <div className="mt-3">
              <FormularioAlerta
                tipo="comunidade"
                modalidades={modalidades}
                rotuloEnviar="Cadastrar interesse"
                dicaValorMinimo={`Em branco vale o piso do mural (${textoLimite}).`}
              />
            </div>
          </details>
        )}

        {interesses.length > 0 && (
          <ul className="flex flex-col gap-3">
            {interesses.map((i) => {
              const resumo = resumoDoAlerta(i.parametros, nomesModalidade);
              return (
                <li key={i.id} className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">{i.nome}</h3>
                      <p className="text-xs text-muted">{resumo.length ? resumo.join(" · ") : `Qualquer licitação a partir de ${textoLimite}`}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {!i.ativo && <Selo tom="aviso">Pausado</Selo>}
                      <Selo tom={i.naoLidos > 0 ? "accent" : "neutro"}>
                        {i.naoLidos === 0 ? "Nada novo" : `${i.naoLidos} ${i.naoLidos === 1 ? "novo" : "novos"}`}
                      </Selo>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {i.naoLidos > 0 && (
                      <form action={acaoMarcarBuscaVista}>
                        <input type="hidden" name="id" value={i.id} />
                        <Botao type="submit" variante="secundario" tamanho="sm" icone={Check}>
                          Marcar como lidos
                        </Botao>
                      </form>
                    )}
                    <Link href={`/comunidade?editar=${i.id}#interesses`} className={linkAcao}>
                      <Pencil aria-hidden className="size-3.5" />
                      Editar<span className="sr-only"> o interesse {i.nome}</span>
                    </Link>
                    <form action={acaoDefinirAlertaAtivo}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="ativo" value={i.ativo ? "0" : "1"} />
                      <Botao type="submit" variante="fantasma" tamanho="sm" icone={i.ativo ? Pause : Play}>
                        {i.ativo ? "Pausar" : "Retomar"}
                        <span className="sr-only"> o interesse {i.nome}</span>
                      </Botao>
                    </form>
                    <form action={acaoRemoverBusca} className="ml-auto">
                      <input type="hidden" name="id" value={i.id} />
                      <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
                        Excluir<span className="sr-only"> o interesse {i.nome}</span>
                      </Botao>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-avisos" className="flex flex-col gap-2">
        <h2 id="titulo-avisos" className="text-base font-semibold">
          Histórico de avisos enviados
        </h2>
        <ListaAvisos avisos={avisos} mostrarAlerta />
      </section>
    </>
  );
}
