import Link from "next/link";
import { Landmark, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { categoriaDoObjeto } from "@/lib/categoria";
import { Botao, Selo } from "./basicos";
import { formatarValor, MedidorAderencia, type LicitacaoResumo } from "./licitacao";

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

function faltam(encerramento: Date, agora: Date) {
  const resto = encerramento.getTime() - agora.getTime();
  if (resto <= 0) return "Encerrada";
  const dias = Math.floor(resto / DIA_MS);
  const horas = Math.floor((resto % DIA_MS) / HORA_MS);
  return dias > 0 ? `faltam ${dias}d ${horas}h` : `faltam ${Math.max(horas, 1)}h`;
}

/** Cartão de sugestão: categoria, aderência, valor e barra do prazo de propostas (da publicação ao encerramento). */
export function CartaoSugerido({
  l,
  publicacao,
  agora,
  acaoAcompanhar,
}: {
  l: LicitacaoResumo;
  publicacao: Date | null;
  agora: Date;
  acaoAcompanhar: (formData: FormData) => Promise<void>;
}) {
  const enc = l.encerramento;
  const pct =
    publicacao && enc && enc > publicacao
      ? Math.min(100, Math.max(0, ((agora.getTime() - publicacao.getTime()) / (enc.getTime() - publicacao.getTime())) * 100))
      : null;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom="sucesso">Recebendo propostas</Selo>
        <Selo>{l.modalidade}</Selo>
        {l.etapaNoFunil && <Selo tom="accent">No funil · {l.etapaNoFunil}</Selo>}
      </div>
      <Link href={l.href} className="line-clamp-3 text-sm font-medium text-ink hover:text-accent hover:underline">
        {l.objeto}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <Selo>{categoriaDoObjeto(l.objeto)}</Selo>
        <MedidorAderencia pontuacao={l.aderencia} motivos={l.motivos} />
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Landmark aria-hidden className="size-3.5 shrink-0" />
          <span className="line-clamp-1">{l.orgao}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          {l.municipio}/{l.uf}
        </span>
      </div>
      <p className="num text-sm text-ink">
        <span className="text-xs text-muted">Valor estimado: </span>
        {formatarValor(l.valorCentavos)}
      </p>
      {enc && (
        <div className="mt-auto flex flex-col gap-1">
          {pct != null && (
            <div
              role="progressbar"
              aria-label="Tempo decorrido do prazo de propostas"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div className={cn("h-full rounded-full", pct >= 80 ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="num flex items-center justify-between text-xs text-muted">
            <span>{publicacao ? `Publicado ${formatoDia.format(publicacao)}` : ""}</span>
            <span className={cn("font-semibold", pct != null && pct >= 80 ? "text-warning" : "text-ink")}>{faltam(enc, agora)}</span>
            <span>Encerra {formatoDia.format(enc)}</span>
          </p>
        </div>
      )}
      <div className="flex items-center justify-end border-t border-line pt-3">
        {l.etapaNoFunil ? (
          <Link
            href="/funil"
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-accent hover:bg-accent-soft"
          >
            Abrir no funil
          </Link>
        ) : (
          <form action={acaoAcompanhar}>
            <input type="hidden" name="numeroControle" value={l.id} />
            <Botao type="submit" variante="secundario" tamanho="sm" icone={Plus}>
              Acompanhar
            </Botao>
          </form>
        )}
      </div>
    </article>
  );
}
