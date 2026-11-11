"use client";

import Link from "next/link";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Botao } from "./basicos";

type Termo = { texto: string; excluido: boolean; bruto: string };

// Mesma sintaxe que websearch_to_tsquery do Postgres entende:
// "frase exata", -excluir e a palavra "or".
const PADRAO_TERMO = /-?"[^"]+"|\S+/g;

export function separarTermos(consulta: string): Termo[] {
  return (consulta.match(PADRAO_TERMO) ?? [])
    .filter((bruto) => bruto.toLowerCase() !== "or")
    .map((bruto) => {
      const excluido = bruto.startsWith("-") && bruto.length > 1;
      const texto = (excluido ? bruto.slice(1) : bruto).replace(/^"|"$/g, "");
      return { texto, excluido, bruto };
    })
    .filter((t) => t.texto.length > 0);
}

export function BuscaComTermos({
  valorInicial = "",
  acao,
  extras = {},
}: {
  valorInicial?: string;
  /** Rota que recebe o GET (?q=...). Sem ela, o formulário só demonstra (página /design). */
  acao?: string;
  /** Filtros atuais que continuam valendo ao buscar de novo. */
  extras?: Record<string, string>;
}) {
  const [consulta, setConsulta] = useState(valorInicial);
  const termos = separarTermos(consulta);

  function remover(bruto: string) {
    setConsulta((atual) => atual.replace(bruto, "").replace(/\s+/g, " ").trim());
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    if (!acao) evento.preventDefault();
  }

  function teclas(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") setConsulta("");
  }

  return (
    <form role="search" method="get" action={acao} onSubmit={enviar} className="flex flex-col gap-2">
      {Object.entries(extras).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <label htmlFor="busca" className="text-sm font-medium text-ink">
        Buscar licitações
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            id="busca"
            name="q"
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={teclas}
            aria-describedby="busca-dica"
            placeholder='Ex.: limpeza predial -vigilância "material de expediente"'
            className="h-11 w-full rounded-md border border-line-strong bg-bg pr-3 pl-9 text-sm text-ink placeholder:text-muted"
          />
        </div>
        <Botao type="submit" tamanho="lg">
          Buscar
        </Botao>
      </div>
      <p id="busca-dica" className="text-xs text-muted">
        Aspas buscam a frase exata. Um hífen antes da palavra tira do resultado. Esc limpa.
      </p>
      {termos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Termos da busca">
          {termos.map((t, i) => (
            <li key={`${t.bruto}-${i}`}>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm py-0.5 pr-1 pl-2 text-xs font-medium",
                  t.excluido ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-strong",
                )}
              >
                {t.excluido && <span>sem</span>}
                {t.texto}
                <button
                  type="button"
                  onClick={() => remover(t.bruto)}
                  aria-label={`Remover termo ${t.texto}`}
                  className="rounded-sm p-0.5 hover:bg-bg"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

/** Filtro que é um link: o estado fica na URL, então dá para salvar e compartilhar a busca. */
export function FiltroLink({ rotulo, href, ativo }: { rotulo: string; href: string; ativo: boolean }) {
  return (
    <Link
      href={href}
      aria-pressed={ativo}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors",
        ativo ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-bg text-ink hover:bg-surface",
      )}
    >
      {rotulo}
    </Link>
  );
}

export function FiltroChip({
  rotulo,
  contador,
  ativoInicial = false,
}: {
  rotulo: string;
  contador?: number;
  ativoInicial?: boolean;
}) {
  const [ativo, setAtivo] = useState(ativoInicial);
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={() => setAtivo((a) => !a)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors",
        ativo ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-bg text-ink hover:bg-surface",
      )}
    >
      {rotulo}
      {contador != null && <span className="num rounded-pill bg-bg px-1.5 text-[11px] text-ink">{contador}</span>}
    </button>
  );
}
