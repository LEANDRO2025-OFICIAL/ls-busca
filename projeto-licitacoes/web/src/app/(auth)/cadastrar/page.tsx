import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { acaoCadastrar } from "@/app/acoes-auth";
import { Alerta, Botao, CampoTexto } from "@/components/ui/basicos";
import { cadastroAberto } from "@/lib/dados/conta";
import { obterDb } from "@/lib/dados/db";

export const metadata: Metadata = { title: "Criar conta" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const ERROS: Record<string, string> = {
  dados: "Confira os campos: nome e empresa com pelo menos 2 letras, e-mail válido e senha com 10 caracteres ou mais.",
  email: "Já existe uma conta com este e-mail. Entre com ela.",
  fechado: "O cadastro está fechado.",
};

async function Erro({ searchParams }: { searchParams: Parametros }) {
  const { erro } = await searchParams;
  const mensagem = typeof erro === "string" ? ERROS[erro] : undefined;
  return mensagem ? <Alerta>{mensagem}</Alerta> : null;
}

export default function PaginaCadastrar({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-line bg-bg p-6 shadow-card">
        <p className="text-sm font-bold">
          LS Busca
        </p>
        <h1 className="text-xl font-bold">Criar conta</h1>
        <Suspense fallback={null}>
          <Erro searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={null}>
          <Formulario />
        </Suspense>
        <p className="text-sm text-muted">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

async function Formulario() {
  await connection();
  if (!(await cadastroAberto(await obterDb()))) {
    return (
      <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink">
        O cadastro está fechado. Peça ao responsável pela conta da sua empresa para adicionar você em Configurações › Equipe.
      </p>
    );
  }
  return (
    <form action={acaoCadastrar} className="flex flex-col gap-4">
      <CampoTexto id="nome" name="nome" rotulo="Seu nome" autoComplete="name" required minLength={2} />
      <CampoTexto id="empresa" name="empresa" rotulo="Empresa" autoComplete="organization" required minLength={2} />
      <CampoTexto id="email" name="email" type="email" rotulo="E-mail" autoComplete="email" required />
      <CampoTexto
        id="senha"
        name="senha"
        type="password"
        rotulo="Senha"
        autoComplete="new-password"
        dica="Pelo menos 10 caracteres. Uma frase curta é mais fácil de lembrar."
        required
        minLength={10}
      />
      <Botao type="submit" tamanho="lg">
        Criar conta
      </Botao>
    </form>
  );
}
