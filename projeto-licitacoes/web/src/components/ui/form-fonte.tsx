"use client";

import { useState } from "react";
import type { FonteId } from "@/lib/fontes/types";

type RespostaConectar = { ok: boolean; mensagem?: string; erro?: string; precisaTokenManual?: boolean };

export function FormConectarFonte({ fonte, conectado }: { fonte: FonteId; conectado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const form = e.currentTarget;
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { if (v) data[k] = String(v); });
    try {
      const r = await fetch("/api/fontes/conectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await r.json() as RespostaConectar;
      if (json.ok) {
        setMsg({ tipo: "ok", texto: json.mensagem ?? "Conectado!" });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMsg({ tipo: "erro", texto: json.erro ?? "Erro desconhecido" });
      }
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="text-sm font-semibold text-accent hover:underline"
      >
        {conectado ? "Atualizar credenciais" : "Conectar"}
      </button>

      {aberto && (
        <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="fonte" type="hidden" value={fonte} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">E-mail de acesso</label>
            <input
              name="login"
              type="email"
              required
              autoComplete="off"
              className="h-9 rounded-md border border-line bg-bg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Senha</label>
            <input
              name="senha"
              type="password"
              autoComplete="current-password"
              className="h-9 rounded-md border border-line bg-bg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {fonte === "alpha" && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted">
                Token manual (substitui login/senha quando o login automático não funcionar)
              </label>
              <input
                name="tokenManual"
                type="password"
                placeholder="eyJhbGci..."
                autoComplete="off"
                className="h-9 rounded-md border border-line bg-bg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          )}

          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60"
            >
              {loading ? "Conectando..." : "Salvar e conectar"}
            </button>
            {msg && (
              <span className={`text-xs ${msg.tipo === "ok" ? "text-success" : "text-danger"}`}>
                {msg.texto}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
