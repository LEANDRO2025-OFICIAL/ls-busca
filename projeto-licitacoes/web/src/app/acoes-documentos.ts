"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { obterDb } from "@/lib/dados/db";
import { criarDocumento, removerDocumento, renovarDocumento } from "@/lib/dados/documentos";
import { ehTipoDocumento, nomeDoTipo } from "@/lib/empresa";
import { exigirOrganizacao } from "@/lib/sessao";

// Cada ação volta para /documentos com ?ok=... ou ?erro=...; a página traduz o código.
function voltar(resultado: string): never {
  redirect(`/documentos?${resultado}`);
}

const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)));
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const esquemaDocumento = z.object({
  tipo: z.string().refine(ehTipoDocumento),
  nome: z.string().trim().max(200),
  numero: textoOpcional(100),
  validade: z.union([data, z.literal("")]).transform((v) => v || null),
  observacao: textoOpcional(500),
});

export async function acaoSalvarDocumento(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const campo = (nome: string) => String(formData.get(nome) ?? "");
  const dados = esquemaDocumento.safeParse({
    tipo: campo("tipo"),
    nome: campo("nome"),
    numero: campo("numero"),
    validade: campo("validade"),
    observacao: campo("observacao"),
  });
  if (!dados.success) voltar("erro=documento");
  // Sem nome, vale o nome do tipo; "Outro documento" precisa de nome.
  const nome = dados.data.nome || (dados.data.tipo === "outro" ? "" : nomeDoTipo(dados.data.tipo));
  if (!nome) voltar("erro=documento");
  await criarDocumento(await obterDb(), organizacaoId, { ...dados.data, nome });
  voltar("ok=criado");
}

const esquemaRenovar = z.object({ id: z.uuid(), validade: data });

export async function acaoRenovarDocumento(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const dados = esquemaRenovar.safeParse({ id: formData.get("id"), validade: formData.get("validade") });
  if (!dados.success) voltar("erro=validade");
  await renovarDocumento(await obterDb(), organizacaoId, dados.data.id, dados.data.validade);
  voltar("ok=renovado");
}

export async function acaoRemoverDocumento(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltar("erro=documento");
  await removerDocumento(await obterDb(), organizacaoId, id.data);
  voltar("ok=removido");
}
