import { ChevronRight } from "lucide-react";
import type { ResumoFase } from "@/lib/etapas";
import { formatarValorCompacto } from "./licitacao";

const porcento = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/**
 * Funil em fluxo horizontal: as 6 fases com quantas licitações estão em cada uma, o valor estimado
 * somado e a taxa de conversão para a fase seguinte (dos que chegaram à fase, quantos seguiram).
 */
export function Pipeline({ fases, encerradas, total }: { fases: ResumoFase[]; encerradas: number; total: number }) {
  const maior = Math.max(1, ...fases.map((f) => f.alcancaram));
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Fases do funil" className="relative flex items-stretch gap-1 overflow-x-auto pb-2">
        {fases.map((f, i) => (
          <li key={f.id} className="flex shrink-0 items-stretch gap-1">
            <div data-fase={f.id} className="flex w-44 flex-col gap-2 rounded-lg border border-line bg-bg p-3 shadow-card">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">{f.nome}</p>
              <p className="num text-2xl font-bold text-ink">
                {f.quantidade}
                <span className="sr-only"> {f.quantidade === 1 ? "licitação nesta fase" : "licitações nesta fase"}</span>
              </p>
              <p className="num text-sm text-ink">{f.valorCentavos > 0 ? formatarValorCompacto(f.valorCentavos) : "—"}</p>
              <div aria-hidden className="h-1.5 rounded-pill bg-surface-2">
                <div className="h-full rounded-pill bg-accent" style={{ width: `${(f.alcancaram / maior) * 100}%` }} />
              </div>
              <p className="num text-xs text-muted">
                {f.alcancaram} {f.alcancaram === 1 ? "chegou" : "chegaram"} até aqui
              </p>
            </div>
            {i < fases.length - 1 && (
              <div className="flex w-14 flex-col items-center justify-center gap-0.5 text-center">
                <ChevronRight aria-hidden className="size-4 text-muted" />
                <span className="num text-sm font-semibold text-accent-strong">
                  {f.conversao == null ? "—" : porcento.format(f.conversao)}
                </span>
                <span className="sr-only">de conversão de {f.nome} para {fases[i + 1].nome}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        {total} {total === 1 ? "licitação acompanhada" : "licitações acompanhadas"} · {encerradas} fora do fluxo (perdidas ou
        desistências). A porcentagem entre as fases é a taxa de conversão: de quem chegou à fase, quantos seguiram para a
        próxima. O valor soma o estimado das licitações que estão na fase agora.
      </p>
    </div>
  );
}
