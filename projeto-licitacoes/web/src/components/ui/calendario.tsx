import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PrazoDoBanco } from "@/lib/dados/prazos";

const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const nomeMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const dois = (n: number) => String(n).padStart(2, "0");

/**
 * Mês com um selo nos dias que têm prazo. "hoje" vem como AAAA-MM-DD (Brasília) por parâmetro
 * para o HTML do servidor e do cliente baterem. hrefMes monta o link do mês anterior e do seguinte.
 */
export function CalendarioMes({
  ano,
  mes,
  hoje,
  eventos,
  hrefMes,
}: {
  ano: number;
  mes: number;
  hoje: string;
  eventos: PrazoDoBanco[];
  hrefMes: (ano: number, mes: number) => string;
}) {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const porDia = new Map<string, number>();
  for (const e of eventos) {
    const chave = chaveDia.format(e.quando);
    porDia.set(chave, (porDia.get(chave) ?? 0) + 1);
  }
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const proximo = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const titulo = nomeMes.format(primeiro);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Link
          href={hrefMes(anterior.ano, anterior.mes)}
          scroll={false}
          className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" />
          <span className="sr-only">Mês anterior</span>
        </Link>
        <p className="text-sm font-semibold text-ink capitalize" aria-live="polite">
          {titulo}
        </p>
        <Link
          href={hrefMes(proximo.ano, proximo.mes)}
          scroll={false}
          className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <ChevronRight aria-hidden className="size-4" />
          <span className="sr-only">Próximo mês</span>
        </Link>
      </div>
      <div aria-hidden className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
        {SEMANA.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: primeiro.getUTCDay() }, (_, i) => (
          <li key={`vazio-${i}`} aria-hidden />
        ))}
        {Array.from({ length: diasNoMes }, (_, i) => {
          const dia = i + 1;
          const chave = `${ano}-${dois(mes)}-${dois(dia)}`;
          const n = porDia.get(chave) ?? 0;
          const ehHoje = chave === hoje;
          const celula = cn(
            "relative flex h-9 items-center justify-center rounded-md text-sm",
            ehHoje ? "bg-accent font-semibold text-on-accent" : n > 0 ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink",
          );
          const rotulo = `${dia}${ehHoje ? ", hoje" : ""}${n > 0 ? `, ${n} ${n === 1 ? "prazo" : "prazos"}` : ""}`;
          return (
            <li key={chave}>
              {n > 0 ? (
                <Link href="/funil/prazos" aria-label={rotulo} className={cn(celula, "hover:opacity-80")}>
                  <span className="num">{dia}</span>
                  <span aria-hidden className="absolute right-1 bottom-0.5 size-1.5 rounded-full bg-current" />
                </Link>
              ) : (
                <span aria-label={rotulo} className={celula}>
                  <span className="num">{dia}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
