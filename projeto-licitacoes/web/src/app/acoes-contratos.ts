"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { obterDb } from "@/lib/dados/db";
import { criarContrato, removerContrato, atualizarAditivo } from "@/lib/dados/contratos";
import { exigirOrganizacao } from "@/lib/sessao";

function voltar(resultado: string): never {
  redirect(`/contratos?${resultado}`);
}

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const valorOpcional = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? null : Math.round(n * 100);
  });

const esquemaContrato = z.object({
  tipo: z.enum(["contrato", "ata"]),
  numero: z.string().trim().min(1).max(100),
  orgaoNome: z.string().trim().min(1).max(300),
  orgaoCnpj: z.string().optional().transform((v) => (v ? v.replace(/\D/g, "") || null : null)),
  objeto: z.string().trim().min(1).max(2000),
  valorTotal: valorOpcional,
  dataInicio: data,
  dataFim: data,
  numeroControlePncp: z.string().trim().optional().transform((v) => v || null),
  linkExterno: z.string().trim().optional().transform((v) => v || null),
  notas: z.string().trim().optional().transform((v) => v || null),
});

export async function acaoSalvarContrato(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const campo = (n: string) => String(formData.get(n) ?? "");
  const dados = esquemaContrato.safeParse({
    tipo: campo("tipo"),
    numero: campo("numero"),
    orgaoNome: campo("orgaoNome"),
    orgaoCnpj: campo("orgaoCnpj"),
    objeto: campo("objeto"),
    valorTotal: campo("valorTotal"),
    dataInicio: campo("dataInicio"),
    dataFim: campo("dataFim"),
    numeroControlePncp: campo("numeroControlePncp"),
    linkExterno: campo("linkExterno"),
    notas: campo("notas"),
  });
  if (!dados.success) voltar("erro=dados");
  await criarContrato(await obterDb(), organizacaoId, {
    tipo: dados.data.tipo,
    numero: dados.data.numero,
    orgaoNome: dados.data.orgaoNome,
    orgaoCnpj: dados.data.orgaoCnpj,
    objeto: dados.data.objeto,
    valorTotalCentavos: dados.data.valorTotal,
    dataInicio: dados.data.dataInicio,
    dataFim: dados.data.dataFim,
    numeroControlePncp: dados.data.numeroControlePncp,
    linkExterno: dados.data.linkExterno,
    notas: dados.data.notas,
  });
  voltar("ok=criado");
}

export async function acaoRemoverContrato(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) voltar("erro=dados");
  await removerContrato(await obterDb(), organizacaoId, id.data);
  voltar("ok=removido");
}

export async function acaoAditivarContrato(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const esquema = z.object({
    id: z.uuid(),
    valorAtual: valorOpcional,
    dataFim: data,
  });
  const dados = esquema.safeParse({
    id: formData.get("id"),
    valorAtual: String(formData.get("valorAtual") ?? ""),
    dataFim: String(formData.get("dataFim") ?? ""),
  });
  if (!dados.success || dados.data.valorAtual == null) voltar("erro=dados");
  await atualizarAditivo(await obterDb(), organizacaoId, dados.data.id, dados.data.valorAtual, dados.data.dataFim);
  voltar("ok=aditivo");
}
