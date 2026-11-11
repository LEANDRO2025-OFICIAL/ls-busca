"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Botao } from "./basicos";

type TomAviso = "sucesso" | "erro" | "info";
type Aviso = { id: number; tom: TomAviso; texto: string };
type Mostrar = (tom: TomAviso, texto: string) => void;

const ContextoAvisos = createContext<Mostrar>(() => {});

export function useAvisos() {
  return useContext(ContextoAvisos);
}

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const sequencia = useRef(0);

  const mostrar = useCallback<Mostrar>((tom, texto) => {
    sequencia.current += 1;
    const id = sequencia.current;
    setAvisos((lista) => [...lista, { id, tom, texto }]);
  }, []);

  const fechar = useCallback((id: number) => {
    setAvisos((lista) => lista.filter((a) => a.id !== id));
  }, []);

  return (
    <ContextoAvisos.Provider value={mostrar}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 md:inset-x-auto md:top-auto md:right-4 md:bottom-4"
      >
        {avisos.map((a) => (
          <ItemAviso key={a.id} aviso={a} fechar={fechar} />
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

const ESTILO: Record<TomAviso, { icone: typeof Info; cor: string }> = {
  sucesso: { icone: CircleCheck, cor: "text-success" },
  erro: { icone: CircleAlert, cor: "text-danger" },
  info: { icone: Info, cor: "text-accent" },
};

function ItemAviso({ aviso, fechar }: { aviso: Aviso; fechar: (id: number) => void }) {
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado) return;
    const timer = setTimeout(() => fechar(aviso.id), 5000);
    return () => clearTimeout(timer);
  }, [pausado, aviso.id, fechar]);

  const { icone: Icone, cor } = ESTILO[aviso.tom];
  return (
    <div
      role={aviso.tom === "erro" ? "alert" : "status"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-md border border-line bg-bg p-3 text-sm text-ink shadow-pop"
    >
      <Icone aria-hidden className={cn("mt-0.5 size-4 shrink-0", cor)} />
      <p className="flex-1">{aviso.texto}</p>
      <button
        type="button"
        onClick={() => fechar(aviso.id)}
        aria-label="Fechar aviso"
        className="rounded-sm p-0.5 text-muted hover:text-ink"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function BotoesDemoAviso() {
  const mostrar = useAvisos();
  return (
    <div className="flex flex-wrap gap-2">
      <Botao variante="secundario" onClick={() => mostrar("sucesso", "Licitação enviada para a triagem.")}>
        Aviso de sucesso
      </Botao>
      <Botao variante="secundario" onClick={() => mostrar("erro", "Não foi possível salvar. Tente de novo.")}>
        Aviso de erro
      </Botao>
      <Botao variante="secundario" onClick={() => mostrar("info", "12 licitações novas na sua busca salva.")}>
        Aviso informativo
      </Botao>
    </div>
  );
}
