"use client";

import { useSyncExternalStore } from "react";
import { Accessibility } from "lucide-react";

// A escolha mora em atributos de <html> (data-contraste, data-texto), que o globals.css lê, e no
// localStorage. O script em app/layout.tsx aplica o que estava salvo antes da tela aparecer.

const OPCOES = [
  { chave: "contraste", valor: "alto", armazenamento: "ls-contraste", rotulo: "Alto contraste" },
  { chave: "texto", valor: "grande", armazenamento: "ls-texto", rotulo: "Texto grande" },
] as const;

function assinar(aviso: () => void) {
  const observador = new MutationObserver(aviso);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-contraste", "data-texto"] });
  return () => observador.disconnect();
}

function alternar(opcao: (typeof OPCOES)[number]) {
  const html = document.documentElement;
  const ligado = html.dataset[opcao.chave] === opcao.valor;
  if (ligado) delete html.dataset[opcao.chave];
  else html.dataset[opcao.chave] = opcao.valor;
  try {
    if (ligado) localStorage.removeItem(opcao.armazenamento);
    else localStorage.setItem(opcao.armazenamento, opcao.valor);
  } catch {
    // Sem armazenamento (navegação privada): vale só até recarregar.
  }
}

function Opcao({ opcao }: { opcao: (typeof OPCOES)[number] }) {
  const ligado = useSyncExternalStore(
    assinar,
    () => document.documentElement.dataset[opcao.chave] === opcao.valor,
    () => false,
  );
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-ink hover:bg-surface">
      <input type="checkbox" checked={ligado} onChange={() => alternar(opcao)} className="size-4 accent-accent" />
      {opcao.rotulo}
    </label>
  );
}

/** Botão da barra superior com os ajustes de leitura: alto contraste e texto grande. */
export function Acessibilidade() {
  return (
    <details className="relative">
      <summary
        aria-label="Ajustes de leitura"
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-line-strong bg-bg hover:bg-surface-2 [&::-webkit-details-marker]:hidden"
      >
        <Accessibility aria-hidden className="size-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-line bg-bg p-2 shadow-pop">
        {OPCOES.map((o) => (
          <Opcao key={o.chave} opcao={o} />
        ))}
      </div>
    </details>
  );
}
