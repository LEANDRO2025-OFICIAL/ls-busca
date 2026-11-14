import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { Esqueleto, EstadoVazio, Selo } from "@/components/ui/basicos";
import { formatarValor, ListaPrazos } from "@/components/ui/licitacao";
import { Indicador, Secao } from "@/components/ui/painel";
import { buscarLicitacoes, filtrosDoRamo, inicioDasNovas, situacaoDaBase } from "@/lib/dados/busca";
import { obterDb } from "@/lib/dados/db";
import { lerResumoFonte, listarStatusConexoes } from "@/lib/dados/fontes";
import { listarCartoes } from "@/lib/dados/funil";
import { obterPerfil } from "@/lib/dados/perfil";
import { listarPrazos } from "@/lib/dados/prazos";
import { ETAPAS, NOME_ETAPA } from "@/lib/etapas";
import { NOME_FONTE, type FonteId } from "@/lib/fontes/types";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Visão geral" };

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const SETE_DIAS_MS = 7 * 86_400_000;

export default function PaginaVisaoGeral() {
  return (
    <main className="mx-auto flex w-full max-w-conteudo flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Visão geral</h1>
        <p className="text-sm text-muted">O resumo do dia: oportunidades do seu ramo, o funil da equipe e os próximos prazos.</p>
      </header>
      <Suspense fallback={<Esqueleto className="h-[32rem] w-full" />}>
        <Painel />
      </Suspense>
    </main>
  );
}

async function Painel() {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const agora = new Date();

  const perfil = await obterPerfil(db, organizacaoId);
  const ramoAtivo = perfil && perfil.termos.length > 0 ? perfil : null;
  const base = await situacaoDaBase(db);
  const ramo = ramoAtivo ? await buscarLicitacoes(db, organizacaoId, filtrosDoRamo(ramoAtivo)) : null;
  const novas = ramoAtivo
    ? await buscarLicitacoes(db, organizacaoId, filtrosDoRamo(ramoAtivo, { novasDesde: inicioDasNovas() }))
    : null;
  const encerrando = ramoAtivo
    ? await buscarLicitacoes(db, organizacaoId, filtrosDoRamo(ramoAtivo, { encerraEmDias: 7 }))
    : null;

  const cartoes = await listarCartoes(db, organizacaoId);
  const porEtapa = new Map(ETAPAS.map((e) => [e, cartoes.filter((c) => c.etapa === e).length]));
  const prazos = (await listarPrazos(db, organizacaoId)).filter(
    (p) => p.quando >= agora && p.quando.getTime() - agora.getTime() <= SETE_DIAS_MS,
  );

  const conexoesFontes = await listarStatusConexoes(db, organizacaoId);
  const fontesAtivas = conexoesFontes.filter((c) => c.status === "ativa");
  const resumosFontes = await Promise.all(
    fontesAtivas.map(async (c) => ({
      fonte: c.fonte,
      resumo: await lerResumoFonte(db, organizacaoId, c.fonte),
    })),
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ramo && novas && encerrando ? (
          <>
            <Indicador rotulo="Combinam com o seu ramo" valor={ramo.total} href="/para-voce" dica="abertas agora" />
            <Indicador rotulo="Novas no seu ramo" valor={novas.total} href="/para-voce?novas=1" dica="nas últimas 24 horas" />
            <Indicador rotulo="Encerram em 7 dias" valor={encerrando.total} href="/buscar?ramo=1&encerra=7" dica="no seu ramo" />
          </>
        ) : (
          <Link
            href="/inicio/ramo"
            className="flex flex-col justify-center gap-1 rounded-lg border border-dashed border-line p-4 text-sm sm:col-span-2 lg:col-span-3"
          >
            <span className="font-semibold text-accent">Cadastre o ramo da empresa</span>
            <span className="text-muted">Com ele, este painel mostra quantas licitações combinam com o que você vende.</span>
          </Link>
        )}
        <Indicador
          rotulo="Abertas no Brasil"
          valor={base.abertas}
          href="/buscar"
          dica={base.ultimaIngestao ? `base de ${formatoDataHora.format(base.ultimaIngestao)}` : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Secao titulo="Mais combinam com a sua empresa"link={ramo ? { href: "/para-voce", rotulo: "Ver todas" } : undefined}>
          {ramo && ramo.linhas.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {ramo.linhas.slice(0, 5).map((l) => (
                <li key={l.numeroControle} className="px-3 py-2">
                  <Link
                    href={`/licitacao/${l.cnpj}/${l.ano}/${l.sequencial}`}
                    className="line-clamp-1 text-sm text-ink hover:text-accent hover:underline"
                  >
                    {l.objeto}
                  </Link>
                  <p className="text-xs text-muted">
                    {l.orgao} · {l.uf} · {formatarValor(l.valorCentavos)}
                    {l.encerramento && ` · encerra ${formatoDataHora.format(l.encerramento)}`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVazio
              icone={Sparkles}
              titulo={ramo ? "Nada aberto no seu ramo agora" : "Sem ramo cadastrado"}
              texto={ramo ? "Inclua mais termos ou sinônimos no ramo." : "Cadastre o ramo para ver as recomendações."}
              acao={
                <Link href="/inicio/ramo" className="text-sm font-semibold text-accent hover:underline">
                  {ramo ? "Ajustar o ramo" : "Cadastrar o ramo"}
                </Link>
              }
            />
          )}
        </Secao>

        <Secao titulo="Seu funil" link={{ href: "/funil", rotulo: "Abrir o funil" }}>
          {cartoes.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma licitação acompanhada ainda. Clique em “Acompanhar” na busca ou em Para sua empresa.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {ETAPAS.map((e) => (
                <li key={e} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-ink">{NOME_ETAPA[e]}</span>
                  <Selo tom={e === "ganhou" ? "sucesso" : e === "perdeu" ? "perigo" : porEtapa.get(e) ? "accent" : "neutro"}>
                    <span className="num">{porEtapa.get(e)}</span>
                  </Selo>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>

      <Secao titulo="Próximos 7 dias" link={{ href: "/funil/prazos", rotulo: "Todos os prazos" }}>
        <ListaPrazos
          agora={agora}
          eventos={prazos.slice(0, 8).map((p) => ({
            id: p.id,
            tipo: p.tipo,
            titulo: p.titulo,
            quando: p.quando,
            href: p.href,
            detalhe: p.objeto,
          }))}
        />
      </Secao>

      {resumosFontes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {resumosFontes.map(({ fonte, resumo }) => resumo && (
            <Secao key={fonte} titulo={NOME_FONTE[fonte as FonteId]} link={{ href: "/fontes", rotulo: "Gerenciar" }}>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface p-3">
                {resumo.totalAbertas != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.totalAbertas.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Abertas</p>
                  </div>
                )}
                {resumo.totalFavoritas != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.totalFavoritas.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Favoritas</p>
                  </div>
                )}
                {resumo.boletinsNaoLidos != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.boletinsNaoLidos.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Boletins</p>
                  </div>
                )}
                {resumo.notificacoesNaoLidas != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.notificacoesNaoLidas.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Notificações</p>
                  </div>
                )}
              </div>
            </Secao>
          ))}
        </div>
      )}
    </>
  );
}
