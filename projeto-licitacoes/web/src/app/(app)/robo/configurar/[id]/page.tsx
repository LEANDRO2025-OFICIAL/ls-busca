import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, OctagonX, Play, Trash2 } from "lucide-react";
import { acaoParadaItem, acaoRemoverRobo, acaoRodarSimulacao } from "@/app/acoes-robo";
import { Alerta, Botao, Esqueleto, Selo } from "@/components/ui/basicos";
import { AvisoModoSimulacao, dataHora, PainelParadaGeral, ROTULO_REGRA } from "@/components/ui/robo";
import { FormularioRobo, type DadosFormularioRobo } from "@/components/ui/robo-formulario";
import { obterDb } from "@/lib/dados/db";
import { lerParadaGeral, listarSimulacoes, obterConfiguracao } from "@/lib/dados/robo";
import { camposDoItem, segundosDeMs } from "@/lib/robo/formulario";
import { ROTULO_ESTRATEGIA, PARAMETROS_PADRAO, type Regra } from "@/lib/robo/tipos";
import { escreverCentesimos, formatarValor } from "@/lib/robo/valores";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Configurar robô" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const MENSAGENS: Record<string, string> = {
  salvo: "Configuração salva.",
  parada: "Parada de emergência acionada. Todos os itens foram parados.",
  liberada: "Parada geral liberada. Os itens continuam parados até serem liberados um a um.",
  "item-parado": "Item parado.",
  "item-liberado": "Item liberado.",
};
const ERROS: Record<string, string> = {
  simulacao: "Não foi possível rodar a simulação. Confira os campos e tente de novo.",
  concorrentes: "Inclua pelo menos um concorrente fictício.",
};

const entrada = "h-10 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-ink";

export default function PaginaConfigurarRobo(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <Link href="/robo" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Voltar para o robô de lance
      </Link>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Conteudo {...props} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params, searchParams }: Props) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { ok, erro } = await searchParams;
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const dados = await obterConfiguracao(db, organizacaoId, id);
  if (!dados) notFound();
  const [parada, simulacoes] = await Promise.all([
    lerParadaGeral(db, organizacaoId),
    dados.config ? listarSimulacoes(db, organizacaoId, dados.config.id) : Promise.resolve([]),
  ]);
  const config = dados.config;
  const voltar = `/robo/configurar/${id}`;
  const desconto = config?.criterio === "maior_desconto";

  const p = config?.parametros ?? PARAMETROS_PADRAO;
  const formulario: DadosFormularioRobo = {
    acompanhamentoId: id,
    versao: config?.versao ?? null,
    criterio: config?.criterio ?? "menor_preco",
    modo: config?.modo ?? "aberto",
    parametros: {
      intervaloProprio: segundosDeMs(p.intervaloProprioMs),
      intervaloMelhor: segundosDeMs(p.intervaloMelhorMs),
      diferencaPropria: escreverCentesimos(p.diferencaPropria),
      diferencaMelhor: escreverCentesimos(p.diferencaMelhor),
    },
    itens: config?.itens.map(camposDoItem) ?? [],
  };
  const itemPadrao = {
    numero: "1",
    descricao: dados.objeto.slice(0, 120),
    referencia: dados.valorEstimadoCentavos ? escreverCentesimos(dados.valorEstimadoCentavos) : "",
    limite: "",
    estrategia: "cobrir",
    decrementoTipo: "fixo",
    decremento: "10,00",
    lancesPorMinuto: "6",
    errosSeguidos: "3",
  };
  const mensagem = typeof ok === "string" ? MENSAGENS[ok] : undefined;
  const mensagemErro = typeof erro === "string" ? ERROS[erro] : undefined;

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{config ? "Robô de lance" : "Configurar robô de lance"}</h1>
        <p className="line-clamp-3 text-sm text-ink">{dados.objeto}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {dados.orgaoUf}
          <Link href={dados.href} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            Ver licitação <ExternalLink aria-hidden className="size-3" />
          </Link>
        </p>
        <AvisoModoSimulacao />
      </header>
      {mensagem && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {mensagem}
        </p>
      )}
      {mensagemErro && <Alerta>{mensagemErro}</Alerta>}
      <PainelParadaGeral parada={parada} voltar={voltar} />

      {config && config.itens.length > 0 && (
        <section aria-labelledby="titulo-itens" className="flex flex-col gap-3">
          <h2 id="titulo-itens" className="text-base font-semibold">
            Itens e simulação
          </h2>
          <ul className="flex flex-col gap-2">
            {config.itens.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    Item {item.numeroItem} · {item.descricao}
                  </p>
                  <p className="text-xs text-muted">
                    {desconto ? "Desconto máximo" : "Piso"} <span className="num font-semibold text-ink">{formatarValor(item.limite, config.criterio)}</span> ·{" "}
                    {ROTULO_ESTRATEGIA[item.estrategia]}
                  </p>
                </div>
                {item.parada ? <Selo tom="perigo">Parado</Selo> : <Selo tom="sucesso">Liberado</Selo>}
                <form action={acaoParadaItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="voltar" value={voltar} />
                  <input type="hidden" name="parada" value={item.parada ? "0" : "1"} />
                  <Botao type="submit" tamanho="sm" variante={item.parada ? "secundario" : "perigo"} icone={item.parada ? Play : OctagonX}>
                    {item.parada ? "Liberar item" : "Parar item"}
                  </Botao>
                </form>
              </li>
            ))}
          </ul>

          <form action={acaoRodarSimulacao} className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3">
            <input type="hidden" name="voltar" value={voltar} />
            <h3 className="text-sm font-semibold text-ink sm:col-span-3">Rodar disputa simulada</h3>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="sim-item" className="text-sm font-medium text-ink">
                Item
              </label>
              <select id="sim-item" name="itemId" className={entrada}>
                {config.itens.map((item) => (
                  <option key={item.id} value={item.id}>
                    Item {item.numeroItem} · {item.descricao.slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-semente" className="text-sm font-medium text-ink">
                Semente
              </label>
              <input id="sim-semente" name="semente" defaultValue="2026" inputMode="numeric" className={entrada} aria-describedby="sim-semente-dica" />
              <p id="sim-semente-dica" className="text-xs text-muted">
                Mesma semente, mesma disputa.
              </p>
            </div>
            {(
              [
                ["agressivos", "Concorrentes agressivos", "1"],
                ["conservadores", "Conservadores", "1"],
                ["desistentes", "Que desistem cedo", "1"],
              ] as const
            ).map(([nome, rotulo, padrao]) => (
              <div key={nome} className="flex flex-col gap-1">
                <label htmlFor={`sim-${nome}`} className="text-sm font-medium text-ink">
                  {rotulo}
                </label>
                <select id={`sim-${nome}`} name={nome} defaultValue={padrao} className={entrada}>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-minutos" className="text-sm font-medium text-ink">
                Fase aberta (min)
              </label>
              <input id="sim-minutos" name="minutos" defaultValue="10" inputMode="numeric" className={entrada} />
            </div>
            <div className="flex flex-col justify-end gap-1 text-sm text-ink sm:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="suspensao" className="size-4 accent-accent" /> Sortear suspensão da disputa
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="falhas" className="size-4 accent-accent" /> Sortear falhas de comunicação
              </label>
            </div>
            <div className="sm:col-span-3">
              <Botao type="submit" icone={Play}>
                Rodar simulação
              </Botao>
            </div>
          </form>
        </section>
      )}

      {simulacoes.length > 0 && (
        <section aria-labelledby="titulo-simulacoes" className="flex flex-col gap-2">
          <h2 id="titulo-simulacoes" className="text-base font-semibold">
            Simulações recentes
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-bg">
            {simulacoes.map((s) => (
              <li key={s.id}>
                <Link href={`/robo/simulacao/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface">
                  <span className="min-w-0 flex-1 truncate text-ink">{s.descricaoItem}</span>
                  <span className="text-xs text-muted">{ROTULO_REGRA[s.parouPor as Regra] ?? s.parouPor}</span>
                  <Selo tom={s.resultado.minhaPosicao === 1 ? "sucesso" : "neutro"}>{s.resultado.minhaPosicao}º lugar</Selo>
                  <span className="text-xs text-muted">{dataHora(s.quando)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-config" className="flex flex-col gap-3">
        <h2 id="titulo-config" className="text-base font-semibold">
          {config ? "Editar configuração" : "Configuração"}
        </h2>
        <FormularioRobo dados={formulario} itemPadrao={itemPadrao} />
      </section>

      {config && (
        <form action={acaoRemoverRobo}>
          <input type="hidden" name="configId" value={config.id} />
          <Botao type="submit" variante="fantasma" tamanho="sm" icone={Trash2}>
            Remover configuração do robô
          </Botao>
        </form>
      )}
    </>
  );
}
