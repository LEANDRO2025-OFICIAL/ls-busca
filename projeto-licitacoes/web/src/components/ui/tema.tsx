"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

// O tema mora em <html data-theme="light|dark">, que o tokens.css lê. O script de app/layout.tsx
// define o atributo antes da primeira pintura: o que estiver salvo em localStorage ("ls-tema") ou,
// sem nada salvo, a preferência do sistema (prefers-color-scheme).

const ARMAZENAMENTO = "ls-tema";

function assinar(aviso: () => void) {
  const observador = new MutationObserver(aviso);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observador.disconnect();
}

function alternar() {
  const html = document.documentElement;
  const novo = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = novo;
  try {
    localStorage.setItem(ARMAZENAMENTO, novo);
  } catch {
    // Sem armazenamento (navegação privada): vale só até recarregar.
  }
}

/** Botão único que alterna entre tema claro e escuro. O rótulo diz o que o clique faz. */
export function AlternarTema({ className }: { className?: string }) {
  const escuro = useSyncExternalStore(
    assinar,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
  const rotulo = escuro ? "Usar tema claro" : "Usar tema escuro";
  const Icone = escuro ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong bg-bg text-ink transition-colors hover:bg-surface-2 active:bg-surface-2",
        className,
      )}
    >
      <Icone aria-hidden className="size-4" />
    </button>
  );
}
