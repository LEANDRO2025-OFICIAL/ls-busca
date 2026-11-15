"use client";

import { useEffect, useRef, useState } from "react";
import type { EstadoSessao } from "@/lib/dados/robo-sessao";

type LogEntry = { id: string; instante: string; nivel: "info" | "lance" | "aviso" | "erro"; texto: string };

const COR: Record<LogEntry["nivel"], string> = {
  info: "text-muted",
  lance: "text-accent font-semibold",
  aviso: "text-warning",
  erro: "text-danger",
};

const ESTADOS_TERMINAIS = new Set<EstadoSessao>(["encerrado", "erro", "parado"]);

export function MonitorSessao({ sessaoId, estadoInicial }: { sessaoId: string; estadoInicial: EstadoSessao }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [estado, setEstado] = useState<EstadoSessao>(estadoInicial);
  const [conectado, setConectado] = useState(!ESTADOS_TERMINAIS.has(estadoInicial));
  const baseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ESTADOS_TERMINAIS.has(estadoInicial)) {
      // Busca os logs históricos via fetch
      fetch(`/api/robo/log/${sessaoId}`, { signal: AbortSignal.timeout(10_000) })
        .then((r) => r.text())
        .then((txt) => {
          const linhas = txt.split("\n\n").filter(Boolean);
          const entradas: LogEntry[] = [];
          for (const bloco of linhas) {
            const dataLine = bloco.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const j = JSON.parse(dataLine.slice(5).trim());
              if ("nivel" in j) entradas.push(j as LogEntry);
            } catch {}
          }
          setLogs(entradas);
        })
        .catch(() => {});
      return;
    }

    const es = new EventSource(`/api/robo/log/${sessaoId}`);
    setConectado(true);

    es.addEventListener("log", (ev) => {
      try {
        const entry = JSON.parse(ev.data) as LogEntry;
        setLogs((prev) => [...prev, entry]);
      } catch {}
    });

    es.addEventListener("status", (ev) => {
      try {
        const { estado: novoEstado } = JSON.parse(ev.data) as { estado: EstadoSessao };
        setEstado(novoEstado);
        if (ESTADOS_TERMINAIS.has(novoEstado)) {
          setConectado(false);
          es.close();
        }
      } catch {}
    });

    es.onerror = () => {
      setConectado(false);
      es.close();
    };

    return () => { es.close(); setConectado(false); };
  }, [sessaoId, estadoInicial]);

  // Rola para o fim quando há novos logs
  useEffect(() => {
    const el = baseRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted">
        {conectado ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 animate-pulse rounded-full bg-accent" />
            Monitorando…
          </span>
        ) : (
          <span className="text-muted">
            {ESTADOS_TERMINAIS.has(estado) ? "Sessão encerrada." : "Conexão perdida."}
          </span>
        )}
      </div>
      <div
        ref={baseRef}
        className="h-[28rem] overflow-y-auto rounded-lg border border-line bg-surface p-3 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <p className="text-muted">Aguardando logs…</p>
        ) : (
          logs.map((e) => (
            <div key={e.id} className={`flex gap-2 py-0.5 ${COR[e.nivel]}`}>
              <span className="shrink-0 opacity-50">{new Date(e.instante).toLocaleTimeString("pt-BR")}</span>
              <span>{e.texto}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
