import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { Esqueleto, Selo } from "@/components/ui/basicos";
import { AvisoModoSimulacao, dataHora, GraficoLances, ROTULO_REGRA, SeloAcao } from "@/components/ui/robo";
import { obterDb } from "@/lib/dados/db";
import { obterSimulacao } from "@/lib/dados/robo";
import { ROTULO_MODO } from "@/lib/robo/formulario";
import { NOME_PROPRIO } from "@/lib/robo/simulador";
import { ROTULO_ESTRATEGIA, type Regra } from "@/lib/robo/tipos";
import { escreverCentesimos, formatarDuracao, formatarValor } from "@/lib/robo/valores";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Simulação do robô" };

type Props = { params: Promise<{ id: string }> };

const PERFIL: Record<string, string> = { agressivo: "agressivo", conservador: "conservador", desistente: "desiste cedo" };

export default function PaginaSimulacao(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 md:px-8">
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Conteudo {...props} />
      </Suspense>
    </main>
  );
}

function Numero({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: "sucesso" | "perigo" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-bg p-3">
      <dt className="text-xs font-medium text-muted">{rotulo}</dt>
      <dd className={`num text-lg font-semibold ${tom === "sucesso" ? "text-success" : tom === "perigo" ? "text-danger" : "text-ink"}`}>{valor}</dd>
      {detalhe && <dd className="text-xs text-muted">{detalhe}</dd>}
    </div>
  );
}

async function Conteudo({ params }: Props) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { organizacaoId } = await exigirOrganizacao();
  const s = await obterSimulacao(await obterDb(), organizacaoId, id);
  if (!s) notFound();
  const { resultado: r, config: c } = s;
  const criterio = c.criterio;
  const desconto = criterio === "maior_desconto";
  const fmt = (v: number) => formatarValor(v, criterio);
  const piso = c.limite ?? 0;
  // Margem: quanto ainda havia até o piso (positiva = sobrou espaço).
  const margem = desconto ? piso - r.meuValor : r.meuValor - piso;
  const margemPct = !desconto && piso > 0 ? escreverCentesimos(Math.round((margem * 10_000) / piso)) : null;
  const meuInicial = s.cenario.meuLanceInicial ?? r.meuValor;
  const iniciais = [
    { nome: NOME_PROPRIO, proprio: true, valor: meuInicial },
    ...s.cenario.concorrentes.map((k) => ({ nome: k.nome, proprio: false, valor: k.lanceInicial })),
  ];
  const lances = s.linhaDoTempo.filter((e) => e.tipo !== "fase");

  return (
    <>
      {s.acompanhamentoId ? (
        <Link href={`/robo/configurar/${s.acompanhamentoId}`} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          Voltar para a configuração
        </Link>
      ) : (
        <Link href="/robo" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          Voltar para o robô de lance
        </Link>
      )}
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Resultado da simulação</h1>
        <p className="text-sm text-ink">{s.descricaoItem}</p>
        <div className="flex flex-wrap gap-1.5">
          <Selo>{desconto ? "Maior desconto" : "Menor preço"}</Selo>
          <Selo>{ROTULO_MODO[s.cenario.modo]}</Selo>
          <Selo>{ROTULO_ESTRATEGIA[c.estrategia]}</Selo>
          <Selo>Semente {s.cenario.semente}</Selo>
          <Selo>{dataHora(s.quando)}</Selo>
        </div>
        <AvisoModoSimulacao />
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="Posição final" valor={`${r.minhaPosicao}º de ${r.classificacao.length}`} tom={r.minhaPosicao === 1 ? "sucesso" : undefined} />
        <Numero rotulo={desconto ? "Maior desconto atingido" : "Menor valor atingido"} valor={fmt(r.meuValor)} detalhe={`Melhor da disputa: ${fmt(r.melhorValor)}`} />
        <Numero
          rotulo={desconto ? "Folga até o desconto máximo" : "Margem sobre o piso"}
          valor={desconto ? `${escreverCentesimos(margem)} p.p.` : fmt(margem)}
          detalhe={`${desconto ? "Desconto máximo" : "Piso"} ${fmt(piso)}${margemPct ? ` · ${margemPct}%` : ""}`}
          tom={margem < 0 ? "perigo" : undefined}
        />
        <Numero rotulo="Seus lances" valor={r.meusLances} detalhe={`${r.totalLances} na disputa · ${formatarDuracao(r.duracaoMs)} de duração`} />
      </dl>
      <p className="flex items-start gap-2 rounded-md bg-surface px-3 py-2 text-sm text-ink">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
        <span>
          O robô parou por: <strong>{ROTULO_REGRA[s.parouPor as Regra] ?? s.parouPor}</strong>.{" "}
          {r.fase === "suspensa" ? "A disputa foi suspensa." : "A disputa terminou encerrada."}
        </span>
      </p>

      <section aria-labelledby="titulo-grafico" className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-4">
        <h2 id="titulo-grafico" className="text-base font-semibold">
          Linha do tempo dos lances
        </h2>
        <GraficoLances eventos={s.linhaDoTempo} iniciais={iniciais} criterio={criterio} piso={piso} duracaoMs={r.duracaoMs} />
      </section>

      <section aria-labelledby="titulo-classificacao" className="flex flex-col gap-2">
        <h2 id="titulo-classificacao" className="text-base font-semibold">
          Classificação final
        </h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Posição</th>
                <th className="px-3 py-2 font-medium">Participante</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.classificacao.map((k) => {
                const perfil = s.cenario.concorrentes.find((x) => x.nome === k.nome)?.perfil;
                return (
                  <tr key={k.nome} className={k.proprio ? "bg-accent-soft font-semibold" : undefined}>
                    <td className="num px-3 py-2">{k.posicao}º</td>
                    <td className="px-3 py-2">
                      {k.nome}
                      {perfil && <span className="text-xs font-normal text-muted"> · {PERFIL[perfil] ?? perfil}</span>}
                      {k.desistiu && <span className="text-xs font-normal text-muted"> · desistiu</span>}
                    </td>
                    <td className="num px-3 py-2 text-right">{fmt(k.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <details className="rounded-lg border border-line bg-bg">
        <summary className="cursor-pointer px-4 py-3 text-base font-semibold">Lances e eventos ({lances.length})</summary>
        <ol className="flex max-h-96 flex-col divide-y divide-line overflow-y-auto border-t border-line">
          {s.linhaDoTempo.map((e, i) => (
            <li key={i} className={`flex gap-3 px-4 py-1.5 text-sm ${e.proprio ? "font-semibold text-accent-strong" : e.tipo === "fase" ? "text-muted italic" : "text-ink"}`}>
              <span className="num w-12 shrink-0 text-xs text-muted">{formatarDuracao(e.instanteMs)}</span>
              <span>{e.texto}</span>
            </li>
          ))}
        </ol>
      </details>

      <section aria-labelledby="titulo-trilha" className="flex flex-col gap-2">
        <h2 id="titulo-trilha" className="text-base font-semibold">
          Trilha de decisões
        </h2>
        <p className="text-xs text-muted">
          Cada decisão do robô, com o que ele viu, a regra aplicada e o motivo. Esperas seguidas pela mesma regra aparecem
          agrupadas. A trilha é gravada só por acréscimo e não pode ser editada.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Instante</th>
                <th className="px-3 py-2 font-medium">Decisão</th>
                <th className="px-3 py-2 font-medium">Regra e motivo</th>
                <th className="px-3 py-2 text-right font-medium">Melhor visto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.decisoes.map((d, i) => (
                <tr key={i} className="align-top">
                  <td className="num px-3 py-2 text-xs whitespace-nowrap text-muted">
                    {formatarDuracao(d.instanteMs)}
                    {d.repeticoes > 1 && ` a ${formatarDuracao(d.ateMs)}`}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <SeloAcao acao={d.acao} />
                    {d.repeticoes > 1 && <span className="ml-1 text-xs text-muted">×{d.repeticoes}</span>}
                    {d.valor != null && <span className="num mt-1 block text-xs font-semibold">{fmt(d.valor)}</span>}
                    {d.envio && d.envio !== "aceito" && <span className="block text-xs text-danger">{d.envio === "erro" ? "erro no envio" : "recusado"}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs font-semibold text-muted">{ROTULO_REGRA[d.regra] ?? d.regra}</span>
                    <span className="block text-ink">{d.motivo}</span>
                    {d.empateFicto && <span className="mt-1 block text-xs text-warning">{d.empateFicto}</span>}
                  </td>
                  <td className="num px-3 py-2 text-right text-xs whitespace-nowrap text-muted">
                    {d.estado?.melhorLance != null ? fmt(d.estado.melhorLance) : "—"}
                    {d.estado?.minhaPosicao != null && <span className="block">você em {d.estado.minhaPosicao}º</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
