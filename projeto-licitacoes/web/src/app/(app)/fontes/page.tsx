import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Esqueleto } from "@/components/ui/basicos";
import { FormConectarFonte } from "@/components/ui/form-fonte";
import { obterDb } from "@/lib/dados/db";
import { lerResumoFonte, listarStatusConexoes } from "@/lib/dados/fontes";
import { NOME_FONTE, type FonteId } from "@/lib/fontes/types";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Fontes de dados" };

const fmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function PaginaFontes() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Fontes de dados</h1>
        <p className="text-sm text-muted">
          Conexões com portais externos. Os dados são consolidados na sua visão geral.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <ListaFontes />
      </Suspense>
    </main>
  );
}

async function ListaFontes() {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const db = await obterDb();
  const conexoes = await listarStatusConexoes(db, organizacaoId);

  const cards = await Promise.all(
    (["alpha", "beta"] as FonteId[]).map(async (f) => {
      const con = conexoes.find((c) => c.fonte === f) ?? null;
      const resumo = con?.status === "ativa" ? await lerResumoFonte(db, organizacaoId, f) : null;
      return { f, con, resumo };
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      {cards.map(({ f, con, resumo }) => {
        const StatusIcone = con?.status === "ativa" ? CheckCircle2 : con?.status === "erro" ? XCircle : AlertCircle;
        const corStatus = con?.status === "ativa" ? "text-success" : con?.status === "erro" ? "text-danger" : "text-muted";
        const textoStatus =
          con?.status === "ativa" ? "Conectada" :
          con?.status === "erro" ? "Erro — verifique as credenciais" :
          "Não configurada";

        return (
          <section key={f} className="rounded-lg border border-line bg-bg p-4 shadow-card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{NOME_FONTE[f]}</h2>
                <span className={`flex items-center gap-1 text-xs ${corStatus}`}>
                  <StatusIcone size={12} aria-hidden /> {textoStatus}
                </span>
                {con?.tokenExpiraEm && con.status === "ativa" && (
                  <p className="mt-0.5 text-xs text-muted">Token expira em {fmt.format(con.tokenExpiraEm)}</p>
                )}
                {con?.ultimaSinc && (
                  <p className="mt-0.5 text-xs text-muted">Última sinc: {fmt.format(con.ultimaSinc)}</p>
                )}
                {con?.ultimoErro && <p className="mt-1 text-xs text-danger">{con.ultimoErro}</p>}
              </div>
            </div>

            {resumo && (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-line bg-surface p-3 sm:grid-cols-4">
                {resumo.totalAbertas != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.totalAbertas.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Abertas</p>
                  </div>
                )}
                {resumo.totalFavoritas != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.totalFavoritas.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Favoritas</p>
                  </div>
                )}
                {resumo.boletinsNaoLidos != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.boletinsNaoLidos.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Boletins</p>
                  </div>
                )}
                {resumo.notificacoesNaoLidas != null && (
                  <div className="text-center">
                    <p className="num text-lg font-bold">{resumo.notificacoesNaoLidas.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted">Notificações</p>
                  </div>
                )}
              </div>
            )}

            <FormConectarFonte fonte={f} conectado={con?.status === "ativa"} />
          </section>
        );
      })}
    </div>
  );
}
