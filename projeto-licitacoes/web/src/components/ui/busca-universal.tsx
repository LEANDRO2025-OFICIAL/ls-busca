"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

type Resultado = {
  id: string;
  objeto: string;
  orgao: string;
  uf: string;
  municipio: string | null;
  valorCentavos: number | null;
  href: string;
};
type Estado = "carregando" | "erro" | "pronto";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Botão da barra superior + diálogo de busca rápida. Abre também com Ctrl+K (ou Cmd+K). */
export function BuscaUniversal() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [termo, setTermo] = useState("");
  const [estado, setEstado] = useState<Estado>("pronto");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [total, setTotal] = useState(0);
  const texto = termo.trim();
  const curto = texto.length < 2;

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dialogo.current?.showModal();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    if (curto) return;
    const controle = new AbortController();
    const espera = setTimeout(async () => {
      setEstado("carregando");
      try {
        const r = await fetch(`/api/busca-rapida?q=${encodeURIComponent(texto)}`, { signal: controle.signal });
        if (!r.ok) throw new Error(String(r.status));
        const dados = (await r.json()) as { total: number; resultados: Resultado[] };
        setResultados(dados.resultados);
        setTotal(dados.total);
        setEstado("pronto");
      } catch {
        if (!controle.signal.aborted) setEstado("erro");
      }
    }, 300);
    return () => {
      clearTimeout(espera);
      controle.abort();
    };
  }, [texto, curto]);

  const fechar = () => dialogo.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        aria-label="Busca rápida"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-9 items-center gap-2 rounded-md border border-line-strong bg-bg px-3 text-sm text-muted hover:bg-surface-2 md:w-72"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate text-left md:inline">Buscar processo, CNPJ, órgão…</span>
        <kbd className="hidden rounded-sm border border-line px-1.5 text-xs md:inline">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogo}
        aria-label="Busca rápida"
        onClick={(e) => e.target === e.currentTarget && fechar()}
        className="m-auto mt-[10vh] w-[min(40rem,92vw)] rounded-lg border border-line bg-bg p-0 text-ink shadow-pop backdrop:bg-black/40"
      >
        <form method="get" action="/buscar" role="search" className="flex items-center gap-2 border-b border-line px-3">
          <Search aria-hidden className="size-4 shrink-0 text-muted" />
          <label htmlFor="busca-rapida" className="sr-only">
            Buscar por objeto, órgão, número do processo ou CNPJ do órgão
          </label>
          <input
            id="busca-rapida"
            name="q"
            type="search"
            autoComplete="off"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Objeto, órgão, processo ou CNPJ do órgão"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
          <button type="button" onClick={fechar} className="rounded-md px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2">
            Esc
          </button>
        </form>

        <div className="max-h-[60vh] overflow-y-auto p-2" aria-live="polite">
          {curto ? (
            <p className="px-2 py-4 text-sm text-muted">Digite ao menos 2 letras. Enter abre a busca completa.</p>
          ) : estado === "carregando" ? (
            <p className="px-2 py-4 text-sm text-muted">Buscando…</p>
          ) : estado === "erro" ? (
            <p className="px-2 py-4 text-sm text-danger">Não consegui buscar agora. Tente de novo.</p>
          ) : resultados.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">Nada aberto com esse termo.</p>
          ) : (
            <>
              <ul className="flex flex-col">
                {resultados.map((r) => (
                  <li key={r.id}>
                    <Link href={r.href} onClick={fechar} className="flex flex-col gap-0.5 rounded-md px-2 py-2 hover:bg-surface">
                      <span className="line-clamp-1 text-sm font-medium text-ink">{r.objeto}</span>
                      <span className="line-clamp-1 text-xs text-muted">
                        {r.orgao} · {r.municipio ? `${r.municipio}/` : ""}
                        {r.uf}
                        {r.valorCentavos != null && ` · ${moeda.format(r.valorCentavos / 100)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/buscar?q=${encodeURIComponent(texto)}`}
                onClick={fechar}
                className="mt-1 block rounded-md px-2 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
              >
                Ver os {total} {total === 1 ? "resultado" : "resultados"} na busca completa
              </Link>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
