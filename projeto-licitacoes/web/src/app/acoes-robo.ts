"use server";

// Robô de lance: ações das telas. MODO SIMULAÇÃO: nenhuma ação aqui envia lance a portal real.
import { redirect } from "next/navigation";
import { z } from "zod";
import { obterDb } from "@/lib/dados/db";
import {
  definirParadaDoItem,
  definirParadaGeral,
  lerParadaGeral,
  obterItemParaSimular,
  registrarSimulacao,
  removerConfiguracao,
  salvarConfiguracao,
} from "@/lib/dados/robo";
import { configDoItem, lerFormularioRobo } from "@/lib/robo/formulario";
import { compactarTrilha, montarCenario, simularDisputa, type Perfil } from "@/lib/robo/simulador";
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

const esquemaSimulacao = z.object({
  itemId: z.uuid(),
  semente: z.coerce.number().int().min(1).max(2_147_483_647),
  agressivos: z.coerce.number().int().min(0).max(4),
  conservadores: z.coerce.number().int().min(0).max(4),
  desistentes: z.coerce.number().int().min(0).max(4),
  minutos: z.coerce.number().int().min(1).max(60),
});

/** Roda uma disputa simulada inteira (relógio virtual: leva milissegundos) e grava sessão e trilha. */
export async function acaoRodarSimulacao(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const volta = destino(formData.get("voltar"));
  const dados = esquemaSimulacao.safeParse({
    itemId: formData.get("itemId"),
    semente: formData.get("semente"),
    agressivos: formData.get("agressivos"),
    conservadores: formData.get("conservadores"),
    desistentes: formData.get("desistentes"),
    minutos: formData.get("minutos"),
  });
  const erro = (codigo: string): never => redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${codigo}`);
  if (!dados.success) erro("simulacao");
  const d = dados.data!;
  const perfis: Perfil[] = [
    ...Array<Perfil>(d.agressivos).fill("agressivo"),
    ...Array<Perfil>(d.conservadores).fill("conservador"),
    ...Array<Perfil>(d.desistentes).fill("desistente"),
  ];
  if (perfis.length === 0) erro("concorrentes");

  const db = await obterDb();
  const alvo = await obterItemParaSimular(db, organizacaoId, d.itemId);
  if (!alvo) erro("simulacao");
  const { item, configId, criterio, modo, parametros } = alvo!;
  const paradaGeral = (await lerParadaGeral(db, organizacaoId)).ativa;
  const config = configDoItem(criterio, item);
  const cenario = montarCenario({
    semente: d.semente,
    criterio,
    modo,
    valorDePartida: item.valorReferencia,
    perfis,
    duracaoAbertaMs: d.minutos * 60_000,
    parametros,
    chanceSuspensaoPorMinuto: formData.get("suspensao") === "on" ? 0.03 : 0,
    chanceErroConector: formData.get("falhas") === "on" ? 0.05 : 0,
  });
  // A parada geral é lida no início: a simulação inteira roda em milissegundos, numa só ação.
  const s = await simularDisputa(config, cenario, () => ({ paradaGlobal: paradaGeral }));
  const id = await registrarSimulacao(db, organizacaoId, usuarioId, {
    configId,
    itemId: item.id,
    descricaoItem: `Item ${item.numeroItem} · ${item.descricao}`,
    config,
    cenario,
    resultado: s.resultado,
    linhaDoTempo: s.linhaDoTempo,
    parouPor: s.registros.at(-1)?.regra ?? "sem_decisao",
    decisoes: compactarTrilha(s.registros),
  });
  if (!id) erro("simulacao");
  redirect(`/robo/simulacao/${id}`);
}
