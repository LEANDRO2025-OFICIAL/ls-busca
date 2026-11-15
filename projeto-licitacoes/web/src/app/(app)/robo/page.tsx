import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Bot, Columns3, Settings2 } from "lucide-react";
import { EstadoVazio, Esqueleto, Selo } from "@/components/ui/basicos";
import { formatarValor } from "@/components/ui/licitacao";
import { AvisoModoSimulacao, dataHora, PainelParadaGeral } from "@/components/ui/robo";
import { obterDb } from "@/lib/dados/db";
import { licitacoesParaRobo, listarConfiguracoes, lerParadaGeral } from "@/lib/dados/robo";
import { ROTULO_MODO } from "@/lib/robo/formulario";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Robô de lance" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const MENSAGENS: Record<string, string> = {
  parada: "Parada de emergência acionada. Todos os itens foram parados.",
  liberada: "Parada geral liberada. Os itens continuam parados até serem liberados um a um.",
  removido: "Configuração removida. As simulações já feitas continuam guardadas.",
};

const linkAcao = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-soft";

export default function PaginaRobo({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Robô de lance</h1>
        <p className="text-sm text-muted">
          Configure, por licitação do funil e por item, até onde o robô pode ir (piso), como ele disputa e os limites de
          segurança. Teste a configuração em disputas simuladas antes de qualquer sessão.
        </p>
        <AvisoModoSimulacao />
      </header>
      <Suspense fallback={<Esqueleto className="h-72 w-full" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { ok } = await searchParams;
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const [parada, configuracoes, licitacoes] = await Promise.all([
    lerParadaGeral(db, organizacaoId),
    listarConfiguracoes(db, organizacaoId),
    licitacoesParaRobo(db, organizacaoId),
  ]);
  const semRobo = licitacoes.filter((l) => !l.temRobo);
  const mensagem = typeof ok === "string" ? MENSAGENS[ok] : undefined;

  return (
    <>
      {mensagem && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {mensagem}
        </p>
      )}
      <PainelParadaGeral parada={parada} voltar="/robo" />

      <section aria-labelledby="titulo-configs" className="flex flex-col gap-3">
        <h2 id="titulo-configs" className="text-base font-semibold">
          Configurações
        </h2>
        {configuracoes.length === 0 ? (
          <EstadoVazio icone={Bot} titulo="Nenhum robô configurado" texto="Escolha abaixo uma licitação do funil para configurar o primeiro." />
        ) : (
          <ul className="flex flex-col gap-2">
            {configuracoes.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{c.objeto}</p>
                    <p className="text-xs text-muted">{c.orgaoUf}</p>
                  </div>
                  <Link href={`/robo/configurar/${c.acompanhamentoId}`} className={linkAcao}>
                    <Settings2 aria-hidden className="size-4" />
                    Abrir
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Selo>{c.criterio === "maior_desconto" ? "Maior desconto" : "Menor preço"}</Selo>
                  <Selo>{ROTULO_MODO[c.modo]}</Selo>
                  <Selo tom="accent">
                    {c.itens} {c.itens === 1 ? "item" : "itens"}
                  </Selo>
                  {c.itensParados > 0 && <Selo tom="perigo">{c.itensParados} parado(s)</Selo>}
                  {c.ultimaSimulacao && (
                    <Link href={`/robo/simulacao/${c.ultimaSimulacao.id}`} className="text-xs text-accent hover:underline">
                      Última simulação: {c.ultimaSimulacao.minhaPosicao}º lugar, {dataHora(c.ultimaSimulacao.quando)}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-novo" className="flex flex-col gap-3">
        <h2 id="titulo-novo" className="text-base font-semibold">
          Configurar a partir do funil
        </h2>
        {licitacoes.length === 0 ? (
          <EstadoVazio
            icone={Columns3}
            titulo="Funil vazio"
            texto="O robô é configurado para licitações que você acompanha. Coloque uma licitação no funil primeiro."
            acao={
              <Link href="/buscar" className="text-sm font-semibold text-accent hover:underline">
                Buscar licitações
              </Link>
            }
          />
        ) : semRobo.length === 0 ? (
          <p className="text-sm text-muted">Todas as licitações em jogo no funil já têm robô configurado.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-bg">
            {semRobo.map((l) => (
              <li key={l.acompanhamentoId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-ink">{l.objeto}</p>
                  <p className="text-xs text-muted">
                    {l.orgaoUf}
                    {l.valorCentavos != null && ` · estimado ${formatarValor(l.valorCentavos)}`}
                  </p>
                </div>
                <Link href={`/robo/configurar/${l.acompanhamentoId}`} className={linkAcao}>
                  <Bot aria-hidden className="size-4" />
                  Configurar robô
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
