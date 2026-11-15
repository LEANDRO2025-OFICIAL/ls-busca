import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FileSignature } from "lucide-react";
import { Alerta, Botao, CampoTexto, Esqueleto } from "@/components/ui/basicos";
import { ParedeUpgrade } from "@/components/ui/parede-upgrade";
import { obterDb } from "@/lib/dados/db";
import { planoOrganizacao } from "@/lib/dados/licenca";
import { planoMinimo, planoTemFuncionalidade } from "@/lib/planos";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Declarações" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

export default function PaginaDeclaracoes({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Gerador de declarações</h1>
        <p className="text-sm text-muted">
          Informe o CNPJ da sua empresa. O sistema busca os dados automaticamente e preenche todas as declarações
          exigidas em pregões e licitações (Lei 14.133/2021). Imprima ou salve como PDF.
        </p>
      </header>
      <Suspense fallback={<Esqueleto className="h-32 w-full" />}>
        <Formulario searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Formulario({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { organizacaoId } = await exigirOrganizacao();
  const plano = await planoOrganizacao(await obterDb(), organizacaoId);
  if (!planoTemFuncionalidade(plano, "declaracoes")) {
    return (
      <ParedeUpgrade
        planoAtual={plano}
        planoNecessario={planoMinimo("declaracoes")}
        funcionalidade="Gerador de declarações"
      />
    );
  }

  const { cnpj: cnpjParam, erro } = await searchParams;
  const cnpjRaw = typeof cnpjParam === "string" ? cnpjParam : "";

  // Se veio CNPJ e não é uma volta de erro, redireciona para a página de declarações
  if (cnpjRaw && !erro) {
    const cnpjLimpo = cnpjRaw.replace(/\D/g, "");
    if (cnpjLimpo.length === 14) {
      redirect(`/declaracoes/${cnpjLimpo}`);
    }
  }

  return (
    <>
      <form method="GET" action="/declaracoes" className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <CampoTexto
            id="dec-cnpj"
            name="cnpj"
            rotulo="CNPJ da empresa"
            defaultValue={cnpjRaw}
            required
            maxLength={18}
            dica="Somente números ou no formato XX.XXX.XXX/XXXX-XX"
          />
        </div>
        <Botao type="submit" icone={FileSignature}>
          Gerar declarações
        </Botao>
      </form>
      {erro && <Alerta>CNPJ não encontrado ou inválido. Verifique e tente novamente.</Alerta>}
      <div className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Declarações geradas automaticamente</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted">
          <li>Declaração de habilitação e conformidade (Lei 14.133/2021)</li>
          <li>Declaração de não emprego de menores (Art. 7º, CF)</li>
          <li>Declaração de elaboração independente de proposta</li>
          <li>Declaração de fatos supervenientes impeditivos</li>
          <li>Declaração de idoneidade (Lei 14.133/2021)</li>
          <li>Declaração de microempresa / EPP / MEI (detectada automaticamente)</li>
          <li>Declaração de inexistência de conflito de interesses</li>
          <li>Declaração de responsabilidade socioambiental</li>
          <li>Declaração de pleno conhecimento do edital</li>
          <li>Declaração de visita técnica (ou dispensa)</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Dados preenchidos automaticamente via consulta pública ao Cadastro Nacional de Pessoas Jurídicas (CNPJ).
          Revise cada declaração antes de assinar.
        </p>
      </div>
    </>
  );
}
