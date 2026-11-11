import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { acaoEntrar } from "@/app/acoes-auth";
import { AlternarTema } from "@/components/ui/tema";
import { Alerta, Botao, CampoTexto } from "@/components/ui/basicos";

export const metadata: Metadata = { title: "Entrar" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const ERROS: Record<string, string> = {
  credenciais: "E-mail ou senha não conferem.",
  limite: "Muitas tentativas seguidas. Espere 15 minutos e tente de novo.",
};

async function Erro({ searchParams }: { searchParams: Parametros }) {
  const { erro } = await searchParams;
  const mensagem = typeof erro === "string" ? ERROS[erro] : undefined;
  return mensagem ? <Alerta>{mensagem}</Alerta> : null;
}

export default function PaginaEntrar({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <AlternarTema className="absolute top-4 right-4" />
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-line bg-bg p-6 shadow-card">
        <p className="text-sm font-bold">
          LS Busca
        </p>
        <h1 className="text-xl font-bold">Entrar</h1>
        <Suspense fallback={null}>
          <Erro searchParams={searchParams} />
        </Suspense>
        <form action={acaoEntrar} className="flex flex-col gap-4">
          <CampoTexto id="email" name="email" type="email" rotulo="E-mail" autoComplete="email" required />
          <CampoTexto id="senha" name="senha" type="password" rotulo="Senha" autoComplete="current-password" required />
          <Botao type="submit" tamanho="lg">
            Entrar
          </Botao>
        </form>
        <p className="text-sm text-muted">
          Ainda não tem conta?{" "}
          <Link href="/cadastrar" className="font-semibold text-accent hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
