"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { obterDb } from "@/lib/dados/db";
import {
  definirParadaDoItem,
  definirParadaGeral,
  removerConfiguracao,
  salvarConfiguracao,
} from "@/lib/dados/robo";
import { lerFormularioRobo } from "@/lib/robo/formulario";
import { exigirOrganizacao } from "@/lib/sessao";

export type EstadoFormularioRobo = { erros: Record<string, string>; valores: Record<string, string> | null; tentativa: number };

/** Volta só para telas do robô (o destino vem do formulário). */
function destino(valor: FormDataEntryValue | null, padrao = "/robo") {
  const v = String(valor ?? "");
  return /^\/robo(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_-]*)?$/.test(v) ? v : padrao;
}

export async function acaoSalvarRobo(anterior: EstadoFormularioRobo, formData: FormData): Promise<EstadoFormularioRobo> {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const campos: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) campos[k] = v;
  const acompanhamentoId = z.uuid().safeParse(campos.acompanhamentoId);
  if (!acompanhamentoId.success) return { erros: { geral: "Licitação inválida." }, valores: campos, tentativa: anterior.tentativa + 1 };
  const leitura = lerFormularioRobo(campos);
  if (!leitura.ok) return { erros: leitura.erros, valores: campos, tentativa: anterior.tentativa + 1 };
  const versao = /^\d{1,9}$/.test(campos.versao ?? "") ? Number(campos.versao) : null;
  const r = await salvarConfiguracao(await obterDb(), organizacaoId, usuarioId, acompanhamentoId.data, leitura.entrada, versao);
  if (!r.ok) {
    const geral =
      r.motivo === "conflito"
        ? "Outra pessoa alterou esta configuração enquanto você editava. Recarregue a página e revise antes de salvar."
        : "Licitação não encontrada no funil da sua empresa.";
    return { erros: { geral }, valores: campos, tentativa: anterior.tentativa + 1 };
  }
  redirect(`/robo/configurar/${acompanhamentoId.data}?ok=salvo`);
}

export async function acaoParadaGeral(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const ativa = formData.get("ativa") === "1";
  await definirParadaGeral(await obterDb(), organizacaoId, usuarioId, ativa);
  const volta = destino(formData.get("voltar"));
  redirect(`${volta}${volta.includes("?") ? "&" : "?"}ok=${ativa ? "parada" : "liberada"}`);
}

export async function acaoParadaItem(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const id = z.uuid().safeParse(formData.get("itemId"));
  const volta = destino(formData.get("voltar"));
  if (!id.success) redirect(volta);
  const parada = formData.get("parada") === "1";
  await definirParadaDoItem(await obterDb(), organizacaoId, id.data, parada);
  redirect(`${volta}${volta.includes("?") ? "&" : "?"}ok=${parada ? "item-parado" : "item-liberado"}`);
}

export async function acaoRemoverRobo(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const id = z.uuid().safeParse(formData.get("configId"));
  if (id.success) await removerConfiguracao(await obterDb(), organizacaoId, id.data);
  redirect("/robo?ok=removido");
}

