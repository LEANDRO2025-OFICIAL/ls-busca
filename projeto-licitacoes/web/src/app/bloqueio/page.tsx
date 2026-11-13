import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { acaoSair } from "@/app/acoes-auth";
import { AlternarTema } from "@/components/ui/tema";
import { obterDb } from "@/lib/dados/db";
import { situacaoDaOrganizacao } from "@/lib/dados/licenca";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Avaliação encerrada" };

export default function PaginaBloqueio() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <AlternarTema className="absolute top-4 right-4" />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </main>
  );
}

async function Conteudo() {
  await connection();
  const sessao = await exigirOrganizacao({ exigirLicenca: false });
  const db = await obterDb();
  const situacao = await situacaoDaOrganizacao(db, sessao.organizacaoId);
  // Se por algum motivo já está liberado (licença ativada enquanto estava aqui), volta ao trabalho.
  if (situacao.liberado) redirect("/inicio");

  const titulo =
    situacao.situacao === "trial_encerrado"
      ? "Período de avaliação encerrado"
      : situacao.situacao === "bloqueada"
        ? "Acesso suspenso"
        : "Licença expirada";

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-line bg-bg p-6 text-center shadow-card">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Lock aria-hidden className="size-6" />
      </span>
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="text-sm text-muted">{situacao.motivo}</p>
      <p className="text-sm text-muted">
        Sua conta continua segura e seus dados preservados. Para voltar a usar o LS Busca, fale com o fornecedor para
        assinar ou renovar a licença.
      </p>
      <form action={acaoSair} className="mt-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md border border-line-strong bg-bg px-4 text-sm font-semibold text-ink hover:bg-surface"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
