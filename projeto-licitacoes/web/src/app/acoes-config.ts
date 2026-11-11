"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { conferirSenha, gerarHash, idSessaoAtual } from "@/lib/auth";
import {
  adicionarMembro,
  ehDono,
  emailEmUso,
  gravarSenha,
  lerHashSenha,
  removerMembro,
  salvarEmpresa,
  salvarMeuNome,
} from "@/lib/dados/conta";
import { obterDb } from "@/lib/dados/db";
import { ehPorte } from "@/lib/empresa";
import { exigirOrganizacao } from "@/lib/sessao";

// Cada ação volta para a página de origem (padrão /configuracoes) com ?ok=... ou ?erro=...; a página traduz o código.
function voltar(resultado: string, pagina = "/configuracoes"): never {
  redirect(`${pagina}?${resultado}`);
}

const esquemaEmpresa = z.object({
  nome: z.string().trim().min(2).max(200),
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 14),
  porte: z.string().refine((v) => v === "" || ehPorte(v)),
});

export async function acaoSalvarEmpresa(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const db = await obterDb();
  if (!(await ehDono(db, organizacaoId, usuarioId))) voltar("erro=permissao", "/empresa");
  const dados = esquemaEmpresa.safeParse({
    nome: formData.get("nome"),
    cnpj: String(formData.get("cnpj") ?? ""),
    porte: String(formData.get("porte") ?? ""),
  });
  if (!dados.success) voltar("erro=empresa", "/empresa");
  await salvarEmpresa(db, organizacaoId, {
    nome: dados.data.nome,
    cnpj: dados.data.cnpj || null,
    porte: dados.data.porte || null,
  });
  voltar("ok=empresa", "/empresa");
}

export async function acaoSalvarMeuNome(formData: FormData) {
  const { usuarioId } = await exigirOrganizacao();
  const nome = z.string().trim().min(2).max(120).safeParse(formData.get("nome"));
  if (!nome.success) voltar("erro=nome");
  await salvarMeuNome(await obterDb(), usuarioId, nome.data);
  voltar("ok=nome");
}

export async function acaoTrocarSenha(formData: FormData) {
  const { usuarioId } = await exigirOrganizacao();
  const atual = String(formData.get("atual") ?? "").slice(0, 200);
  const nova = String(formData.get("nova") ?? "");
  if (nova.length < 10 || nova.length > 200) voltar("erro=senha-curta");
  if (nova !== String(formData.get("confirmacao") ?? "")) voltar("erro=senha-confirmacao");
  const db = await obterDb();
  const hash = await lerHashSenha(db, usuarioId);
  if (!hash || !(await conferirSenha(atual, hash))) voltar("erro=senha-atual");
  await gravarSenha(db, usuarioId, await gerarHash(nova), await idSessaoAtual());
  voltar("ok=senha");
}

const esquemaMembro = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.email().max(200).transform((e) => e.toLowerCase()),
  senha: z.string().min(10).max(200),
});

export async function acaoAdicionarMembro(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const db = await obterDb();
  if (!(await ehDono(db, organizacaoId, usuarioId))) voltar("erro=permissao");
  const dados = esquemaMembro.safeParse({
    nome: formData.get("nome"),
    email: String(formData.get("email") ?? "").trim(),
    senha: formData.get("senha"),
  });
  if (!dados.success) voltar("erro=membro");
  if (await emailEmUso(db, dados.data.email)) voltar("erro=email");
  await adicionarMembro(db, organizacaoId, {
    id: randomUUID(),
    nome: dados.data.nome,
    email: dados.data.email,
    hash: await gerarHash(dados.data.senha),
  });
  voltar("ok=membro");
}

export async function acaoRemoverMembro(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const db = await obterDb();
  if (!(await ehDono(db, organizacaoId, usuarioId))) voltar("erro=permissao");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || id.data === usuarioId) voltar("erro=permissao");
  await removerMembro(db, organizacaoId, id.data);
  voltar("ok=removido");
}
