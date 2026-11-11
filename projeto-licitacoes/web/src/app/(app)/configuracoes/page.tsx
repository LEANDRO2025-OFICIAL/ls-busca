import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { UserPlus, UserX } from "lucide-react";
import {
  acaoAdicionarMembro,
  acaoRemoverMembro,
  acaoSalvarMeuNome,
  acaoTrocarSenha,
} from "@/app/acoes-config";
import { Alerta, Botao, CampoTexto, Esqueleto, Selo } from "@/components/ui/basicos";
import { obterConta } from "@/lib/dados/conta";
import { obterDb } from "@/lib/dados/db";
import { exigirOrganizacao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Conta e equipe" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

const SUCESSOS: Record<string, string> = {
  nome: "Seu nome foi salvo.",
  senha: "Senha trocada. Os outros aparelhos conectados precisam entrar de novo.",
  membro: "Pessoa adicionada. Passe a ela o e-mail e a senha inicial; ela pode trocar a senha aqui.",
  removido: "Pessoa removida da equipe.",
};

const ERROS: Record<string, string> = {
  permissao: "Só o dono da conta da empresa pode fazer isso.",
  nome: "O nome precisa ter de 2 a 120 letras.",
  "senha-atual": "A senha atual não confere.",
  "senha-curta": "A nova senha precisa ter pelo menos 10 caracteres.",
  "senha-confirmacao": "A confirmação não é igual à nova senha.",
  membro: "Confira nome, e-mail e senha inicial (pelo menos 10 caracteres).",
  email: "Já existe uma conta com esse e-mail.",
};

const PAPEL: Record<string, string> = { dono: "Dono", membro: "Membro" };

export default function PaginaConfiguracoes({ searchParams }: { searchParams: Parametros }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-xl font-bold">Conta e equipe</h1>
        <p className="text-sm text-muted">Sua conta e as pessoas da equipe. Nome, CNPJ e porte ficam no perfil da empresa.</p>
      </header>
      <Suspense fallback={<Esqueleto className="h-96 w-full" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Secao({ titulo, texto, children }: { titulo: string; texto?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-4">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        {texto && <p className="text-xs text-muted">{texto}</p>}
      </div>
      {children}
    </section>
  );
}

async function Conteudo({ searchParams }: { searchParams: Parametros }) {
  await connection();
  const { ok, erro } = await searchParams;
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const conta = await obterConta(await obterDb(), organizacaoId, usuarioId);
  const sucesso = typeof ok === "string" ? SUCESSOS[ok] : undefined;
  const falha = typeof erro === "string" ? ERROS[erro] : undefined;

  return (
    <>
      {sucesso && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {sucesso}
        </p>
      )}
      {falha && <Alerta>{falha}</Alerta>}

      <Secao titulo="Empresa" texto={conta.empresa.nome}>
        <Link href="/empresa" className="w-fit text-sm font-semibold text-accent hover:underline">
          Editar nome, CNPJ e porte da empresa
        </Link>
      </Secao>

      <Secao titulo="Ramo de atuação" texto="O que a empresa vende, onde atende e quais modalidades interessam.">
        <Link href="/inicio/ramo" className="w-fit text-sm font-semibold text-accent hover:underline">
          Editar o ramo da empresa
        </Link>
      </Secao>

      <Secao titulo="Minha conta" texto={conta.eu?.email}>
        <form action={acaoSalvarMeuNome} className="flex flex-wrap items-end gap-3">
          <CampoTexto
            id="meu-nome"
            name="nome"
            rotulo="Seu nome"
            defaultValue={conta.eu?.nome}
            required
            minLength={2}
            maxLength={120}
            className="min-w-60 flex-1"
          />
          <Botao type="submit" variante="secundario">
            Salvar nome
          </Botao>
        </form>
        <form action={acaoTrocarSenha} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
          <h3 className="text-sm font-semibold sm:col-span-3">Trocar senha</h3>
          <CampoTexto id="senha-atual" name="atual" type="password" rotulo="Senha atual" autoComplete="current-password" required />
          <CampoTexto
            id="senha-nova"
            name="nova"
            type="password"
            rotulo="Nova senha"
            autoComplete="new-password"
            minLength={10}
            dica="Pelo menos 10 caracteres."
            required
          />
          <CampoTexto
            id="senha-confirmacao"
            name="confirmacao"
            type="password"
            rotulo="Repita a nova senha"
            autoComplete="new-password"
            minLength={10}
            required
          />
          <div className="sm:col-span-3">
            <Botao type="submit" variante="secundario">
              Trocar senha
            </Botao>
          </div>
        </form>
      </Secao>

      <Secao titulo="Equipe" texto="Todos veem a mesma busca, o mesmo funil e os mesmos prazos da empresa.">
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {conta.membros.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">
                  {m.nome}
                  {m.id === usuarioId && <span className="font-normal text-muted"> (você)</span>}
                </span>
                <span className="block truncate text-xs text-muted">{m.email}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Selo tom={m.papel === "dono" ? "accent" : "neutro"}>{PAPEL[m.papel] ?? m.papel}</Selo>
                {conta.ehDono && m.papel !== "dono" && (
                  <form action={acaoRemoverMembro}>
                    <input type="hidden" name="id" value={m.id} />
                    <Botao type="submit" variante="fantasma" tamanho="sm" icone={UserX}>
                      Remover<span className="sr-only"> {m.nome}</span>
                    </Botao>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
        {conta.ehDono && (
          <form action={acaoAdicionarMembro} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
            <h3 className="text-sm font-semibold sm:col-span-3">Adicionar pessoa</h3>
            <CampoTexto id="membro-nome" name="nome" rotulo="Nome" required minLength={2} maxLength={120} />
            <CampoTexto id="membro-email" name="email" type="email" rotulo="E-mail" autoComplete="off" required />
            <CampoTexto
              id="membro-senha"
              name="senha"
              type="password"
              rotulo="Senha inicial"
              autoComplete="new-password"
              minLength={10}
              dica="Pelo menos 10 caracteres."
              required
            />
            <div className="sm:col-span-3">
              <Botao type="submit" variante="secundario" icone={UserPlus}>
                Adicionar à equipe
              </Botao>
            </div>
          </form>
        )}
      </Secao>
    </>
  );
}
