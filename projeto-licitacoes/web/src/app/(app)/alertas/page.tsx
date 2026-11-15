import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BellOff, Check, History, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { acaoDefinirAlertaAtivo, acaoMarcarBuscaVista, acaoRemoverBusca } from "@/app/acoes";
import { FormularioAlerta, ListaAvisos, resumoDoAlerta } from "@/components/ui/alertas";
import { Alerta, Botao, Esqueleto, EstadoVazio, Selo } from "@/components/ui/basicos";
import { listarAvisos, listarBuscasSalvas } from "@/lib/dados/alertas";
import { obterDb } from "@/lib/dados/db";
import { listarModalidades } from "@/lib/dados/perfil";
import { lerFiltros, montarHref } from "@/lib/filtros-busca";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Alertas" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const linkAcao = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-soft";

export default function PaginaAlertas({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Alertas</h1>
        <p className="text-sm text-muted">
          Salve uma busca como alerta: quando entrar na base uma licitação que casa com ela, você recebe um aviso aqui e no
          sino. Cada licitação é avisada uma única vez por alerta.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-64 w-full" />}>
        <Lista searchParams={searchParams} />
      </Suspense>
      <p className="text-xs text-muted">
        Os avisos são gerados a cada atualização da base pelo PNCP. Para receber também fora do sistema, configure um
        webhook (ALERTA_WEBHOOK_URL, descrito no README); não há envio de e-mail.
      </p>
    </main>
  );
}

async function Lista({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { editar, historico, erro, ok } = await searchParams;
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const alertas = await listarBuscasSalvas(db, organizacaoId, { tipo: "busca" });
  const modalidades = await listarModalidades(db);
  const nomesModalidade = new Map(modalidades.map((m) => [m.id, m.nome]));
  const emEdicao = alertas.find((a) => a.id === editar);
  const comHistorico = alertas.find((a) => a.id === historico);
  const naoLidos = await listarAvisos(db, organizacaoId, { tipo: "busca", apenasNaoLidos: true, limite: 200 });
  const avisosDoHistorico = comHistorico
    ? await listarAvisos(db, organizacaoId, { tipo: "busca", alertaId: comHistorico.id, limite: 100 })
    : [];

  return (
    <>
      {erro === "dados" && <Alerta>Dê um nome ao alerta e preencha pelo menos um filtro (termos, UF, município, modalidade ou valor).</Alerta>}
      {(ok === "criado" || ok === "editado") && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {ok === "criado" ? "Alerta criado. Você será avisado das próximas licitações que casarem." : "Alerta atualizado."}
        </p>
      )}

      {emEdicao ? (
        <section aria-labelledby="titulo-editar" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <h2 id="titulo-editar" className="text-base font-semibold">
            Editar alerta
          </h2>
          <FormularioAlerta tipo="busca" alerta={emEdicao} modalidades={modalidades} rotuloEnviar="Salvar alterações" />
        </section>
      ) : (
        <details className="rounded-lg border border-line bg-surface p-4" open={alertas.length === 0 || erro === "dados"}>
          <summary className="cursor-pointer text-base font-semibold text-ink">Novo alerta</summary>
          <div className="mt-3">
            <FormularioAlerta tipo="busca" modalidades={modalidades} rotuloEnviar="Criar alerta" />
          </div>
          <p className="mt-3 text-xs text-muted">
            Também dá para criar pela{" "}
            <Link href="/buscar" className="font-semibold text-accent hover:underline">
              busca
            </Link>
            : aplique os filtros e clique em “Salvar alerta”.
          </p>
        </details>
      )}

      {alertas.length === 0 ? (
        <EstadoVazio
          icone={BellOff}
          titulo="Nenhum alerta ainda"
          texto="Crie um alerta acima ou salve uma busca. As licitações novas que casarem aparecem aqui e no sino."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {alertas.map((b) => {
            const novos = naoLidos.filter((a) => a.alertaId === b.id);
            const { atuais } = lerFiltros(b.parametros);
            return (
              <li key={b.id} className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-ink">{b.nome}</h2>
                    <p className="text-xs text-muted">{resumoDoAlerta(b.parametros, nomesModalidade).join(" · ")}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {!b.ativo && <Selo tom="aviso">Pausado</Selo>}
                    <Selo tom={b.naoLidos > 0 ? "accent" : "neutro"}>
                      {b.naoLidos === 0 ? "Nada novo" : `${b.naoLidos} ${b.naoLidos === 1 ? "novo" : "novos"}`}
                    </Selo>
                  </div>
                </div>

                {novos.length > 0 && <ListaAvisos avisos={novos.slice(0, 3)} />}

                <div className="flex flex-wrap items-center gap-1">
                  {b.naoLidos > 0 && (
                    <form action={acaoMarcarBuscaVista}>
                      <input type="hidden" name="id" value={b.id} />
                      <Botao type="submit" variante="secundario" tamanho="sm" icone={Check}>
                        Marcar como lidos
                      </Botao>
                    </form>
                  )}
                  <Link href={montarHref(atuais, { desde: null })} className={linkAcao}>
                    Ver a busca
                  </Link>
                  <Link href={`/alertas?historico=${b.id}#historico`} className={linkAcao}>
                    <History aria-hidden className="size-3.5" />
                    Histórico ({b.totalAvisos})
                  </Link>
                  <Link href={`/alertas?editar=${b.id}`} className={linkAcao}>
                    <Pencil aria-hidden className="size-3.5" />
                    Editar<span className="sr-only"> o alerta {b.nome}</span>
                  </Link>
                  <form action={acaoDefinirAlertaAtivo}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="ativo" value={b.ativo ? "0" : "1"} />
                    <Botao type="submit" variante="fantasma" tamanho="sm" icone={b.ativo ? Pause : Play}>
                      {b.ativo ? "Pausar" : "Retomar"}
                      <span className="sr-only"> o alerta {b.nome}</span>
                    </Botao>
                  </form>
                  <form action={acaoRemoverBusca} className="ml-auto">
                    <input type="hidden" name="id" value={b.id} />
                    <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
                      Excluir<span className="sr-only"> o alerta {b.nome}</span>
                    </Botao>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {comHistorico && (
        <section id="historico" aria-labelledby="titulo-historico" className="flex flex-col gap-2">
          <h2 id="titulo-historico" className="text-base font-semibold">
            Histórico de avisos · {comHistorico.nome}
          </h2>
          <ListaAvisos avisos={avisosDoHistorico} />
        </section>
      )}
    </>
  );
}
