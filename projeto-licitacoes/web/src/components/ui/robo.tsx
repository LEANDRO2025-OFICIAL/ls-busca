import { OctagonX, Play } from "lucide-react";
import { acaoParadaGeral } from "@/app/acoes-robo";
import type { ParadaGeral } from "@/lib/dados/robo";
import type { Criterio, Regra } from "@/lib/robo/tipos";
import { cn } from "@/lib/cn";
import { Selo, type TomSelo } from "./basicos";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const dataHora = (d: Date) => formatoDataHora.format(d);

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

