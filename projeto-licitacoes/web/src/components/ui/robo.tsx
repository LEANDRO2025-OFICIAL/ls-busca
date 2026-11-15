import { FlaskConical, OctagonX, Play } from "lucide-react";
import { acaoParadaGeral } from "@/app/acoes-robo";
import type { ParadaGeral } from "@/lib/dados/robo";
import type { EventoSimulado } from "@/lib/robo/simulador";
import type { Acao, Criterio, Regra } from "@/lib/robo/tipos";
import { formatarDuracao, formatarValor } from "@/lib/robo/valores";
import { cn } from "@/lib/cn";
import { Selo, type TomSelo } from "./basicos";

export const TEXTO_MODO_SIMULACAO = "Modo simulação. Envio de lances a portais reais não está implementado.";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const dataHora = (d: Date) => formatoDataHora.format(d);

/** Faixa fixa no topo de toda tela do robô. */
export function AvisoModoSimulacao() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
      {TEXTO_MODO_SIMULACAO}
    </p>
  );
}

/** Parada de emergência geral: botão grande. Ligada, nenhum item do robô dá lance. */
export function PainelParadaGeral({ parada, voltar }: { parada: ParadaGeral; voltar: string }) {
  return (
    <section
      aria-labelledby="titulo-parada"
      className={cn("flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center", parada.ativa ? "border-danger bg-danger-soft" : "border-line bg-surface")}
    >
      <div className="flex-1">
        <h2 id="titulo-parada" className="text-base font-semibold text-ink">
          Parada de emergência {parada.ativa ? "acionada" : "geral"}
        </h2>
        <p className="text-sm text-muted">
          {parada.ativa
            ? `Nenhum item do robô dá lance enquanto ela estiver acionada${parada.alteradaEm ? ` (desde ${dataHora(parada.alteradaEm)}${parada.alteradaPor ? `, por ${parada.alteradaPor}` : ""})` : ""}. Liberar não religa os itens: cada um precisa ser liberado na própria configuração.`
            : "Para todos os robôs da empresa na hora, e marca a parada de cada item."}
        </p>
      </div>
      <form action={acaoParadaGeral}>
        <input type="hidden" name="voltar" value={voltar} />
        <input type="hidden" name="ativa" value={parada.ativa ? "0" : "1"} />
        {parada.ativa ? (
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-bg px-5 text-sm font-semibold text-ink hover:bg-surface">
            <Play aria-hidden className="size-4" />
            Liberar parada geral
          </button>
        ) : (
          <button
            type="submit"
            className="inline-flex h-14 items-center gap-2.5 rounded-lg bg-danger px-6 text-base font-bold text-on-accent shadow-card hover:opacity-90 active:opacity-80"
          >
            <OctagonX aria-hidden className="size-6" />
            Parada de emergência
          </button>
        )}
      </form>
    </section>
  );
}

export const ROTULO_REGRA: Record<Regra | "sem_decisao", string> = {
  parada_emergencia_global: "Parada de emergência geral",
  parada_emergencia_item: "Parada de emergência do item",
  configuracao_invalida: "Configuração recusada",
  erros_do_conector: "Erros seguidos do conector",
  estado_inconsistente: "Estado inconsistente",
  disputa_encerrada: "Disputa encerrada",
  disputa_suspensa: "Disputa suspensa",
  piso_atingido: "Piso atingido",
  piso_exato: "Lance no piso exato",
  cobrir: "Cobrir o melhor lance",
  primeiro: "Ficar em 1º",
  posicao_alvo: "Posição alvo",
  ultimos_segundos: "Últimos segundos",
  lance_final: "Lance final",
  ja_na_posicao: "Já na posição desejada",
  fora_da_janela: "Fora da janela de tempo",
  aguardar_fase: "Aguardando a fase",
  sem_espaco: "Sem espaço para lance",
  limite_desconto_por_lance: "Limite de variação por lance",
  intervalo_proprio: "Intervalo entre lances próprios",
  intervalo_melhor: "Intervalo após o melhor lance",
  limite_por_minuto: "Limite de lances por minuto",
  erro_do_conector: "Erro do conector",
  sem_decisao: "Sem decisão",
};

const TOM_ACAO: Record<Acao, TomSelo> = { lancar: "accent", aguardar: "neutro", parar: "perigo" };
const ROTULO_ACAO: Record<Acao, string> = { lancar: "Lançar", aguardar: "Aguardar", parar: "Parar" };
export function SeloAcao({ acao }: { acao: Acao }) {
  return <Selo tom={TOM_ACAO[acao]}>{ROTULO_ACAO[acao]}</Selo>;
}

/**
 * Linha do tempo dos lances: o melhor valor de cada participante ao longo da disputa, em degraus.
 * Os próprios em destaque (cor de destaque, traço grosso); concorrentes em tons neutros e tracejados distintos.
 */
export function GraficoLances({
  eventos,
  iniciais,
  criterio,
  piso,
  duracaoMs,
}: {
  eventos: EventoSimulado[];
  iniciais: { nome: string; proprio: boolean; valor: number }[];
  criterio: Criterio;
  piso: number;
  duracaoMs: number;
}) {
  const L = 720;
  const A = 260;
  const m = { e: 92, d: 12, t: 12, b: 28 };
  const series = iniciais.map((p) => ({ ...p, pontos: [{ t: 0, v: p.valor }] }));
  for (const e of eventos) {
    if (e.tipo !== "lance" || e.valor == null) continue;
    series.find((s) => s.nome === e.autor)?.pontos.push({ t: e.instanteMs, v: e.valor });
  }
  const valores = [piso, ...series.flatMap((s) => s.pontos.map((p) => p.v))];
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const fim = Math.max(duracaoMs, 1);
  const x = (t: number) => m.e + ((L - m.e - m.d) * t) / fim;
  const y = (v: number) => m.t + ((A - m.t - m.b) * (max - v)) / (max - min);
  const caminho = (pontos: { t: number; v: number }[]) => {
    let d = `M${x(pontos[0].t).toFixed(1)},${y(pontos[0].v).toFixed(1)}`;
    for (let i = 1; i < pontos.length; i++) d += ` H${x(pontos[i].t).toFixed(1)} V${y(pontos[i].v).toFixed(1)}`;
    return `${d} H${x(fim).toFixed(1)}`;
  };
  const tracos = ["6 3", "2 3", "8 3 2 3", "1 2", "10 4"];
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Gráfico dos lances ao longo da disputa simulada" className="w-full text-muted">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={m.e - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[10px]">
              {formatarValor(Math.round(v), criterio)}
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={x(fim * f)} y={A - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} className="fill-muted text-[10px]">
            {formatarDuracao(fim * f)}
          </text>
        ))}
        <line x1={m.e} x2={L - m.d} y1={y(piso)} y2={y(piso)} className="stroke-danger" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={L - m.d} y={y(piso) - 4} textAnchor="end" className="fill-danger text-[10px] font-semibold">
          {criterio === "maior_desconto" ? "Desconto máximo" : "Piso"}
        </text>
        {series
          .filter((s) => !s.proprio)
          .map((s, i) => (
            <path key={s.nome} d={caminho(s.pontos)} fill="none" className="stroke-muted" strokeWidth={1.5} strokeDasharray={tracos[i % tracos.length]} />
          ))}
        {series
          .filter((s) => s.proprio)
          .map((s) => (
            <path key={s.nome} d={caminho(s.pontos)} fill="none" className="stroke-accent" strokeWidth={3} />
          ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-[3px] w-5 rounded-full bg-accent" /> Você
        </span>
        {series
          .filter((s) => !s.proprio)
          .map((s, i) => (
            <span key={s.nome} className="inline-flex items-center gap-1.5">
              <svg aria-hidden width="20" height="4" className="text-muted">
                <line x1="0" x2="20" y1="2" y2="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray={tracos[i % tracos.length]} />
              </svg>
              {s.nome}
            </span>
          ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0 w-5 border-t-[1.5px] border-dashed border-danger" /> {criterio === "maior_desconto" ? "Desconto máximo" : "Piso"}
        </span>
      </figcaption>
    </figure>
  );
}
