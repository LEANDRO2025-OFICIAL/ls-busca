"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { obterDb } from "@/lib/dados/db";
import {
  atualizarEstadoSessao,
  criarSessao,
  listarCredenciais,
  removerCredencial,
  salvarCredencial,
  type Portal,
  PORTAIS,
} from "@/lib/dados/robo-sessao";
import { iniciarRunnerBackground } from "@/lib/robo/runner";
import { exigirOrganizacao } from "@/lib/sessao";

function destino(valor: FormDataEntryValue | null, padrao = "/robo") {
  const v = String(valor ?? "");
  return /^\/robo(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_-]*)?$/.test(v) ? v : padrao;
}

// ─────────── Credenciais ───────────

export async function acaoSalvarCredencial(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const portal = formData.get("portal") as string;
  const apelido = String(formData.get("apelido") ?? "").trim().slice(0, 80);
  const login = String(formData.get("login") ?? "").trim().slice(0, 200);
  const senha = String(formData.get("senha") ?? "");
  const voltar = destino(formData.get("voltar"));
  if (!(PORTAIS as readonly string[]).includes(portal) || apelido.length < 2 || login.length < 3 || senha.length < 4) {
    redirect(`${voltar}?erro=credencial-invalida`);
  }
  const db = await obterDb();
  await salvarCredencial(db, organizacaoId, portal as Portal, apelido, login, senha);
  redirect(`${voltar}?ok=credencial-salva`);
}

export async function acaoRemoverCredencial(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const credencialId = z.uuid().safeParse(formData.get("credencialId"));
  const voltar = destino(formData.get("voltar"));
  if (!credencialId.success) redirect(voltar);
  const db = await obterDb();
  await removerCredencial(db, organizacaoId, credencialId.data);
  redirect(`${voltar}?ok=credencial-removida`);
}

// ─────────── Sessão do robô real ───────────

/** Inicia uma sessão do robô real. Redireciona para a tela de monitoramento. */
export async function acaoIniciarSessao(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const roboConfigId = z.uuid().safeParse(formData.get("roboConfigId"));
  // roboItem = "uuid|numeroItem" (combined from select)
  const roboItemRaw = String(formData.get("roboItem") ?? "").split("|");
  const roboItemId = z.uuid().safeParse(roboItemRaw[0]);
  const numeroItem = Math.max(1, Number(roboItemRaw[1] ?? "1") || 1);
  const credencialId = z.uuid().nullish().safeParse(formData.get("credencialId") || null);
  const urlDisputa = String(formData.get("urlDisputa") ?? "").trim();
  const portal = formData.get("portal") as string;
  const voltar = destino(formData.get("voltar"), "/robo");

  if (!roboConfigId.success || !roboItemId.success) redirect(`${voltar}?erro=sessao-invalida`);
  if (!(PORTAIS as readonly string[]).includes(portal)) redirect(`${voltar}?erro=sessao-invalida`);
  if (!urlDisputa.startsWith("https://")) redirect(`${voltar}?erro=url-invalida`);

  const db = await obterDb();
  const sessaoId = await criarSessao(
    db, organizacaoId, usuarioId,
    roboConfigId.data, roboItemId.data,
    credencialId.success && credencialId.data ? credencialId.data : null,
    portal as Portal, urlDisputa,
    isNaN(numeroItem) || numeroItem < 1 ? 1 : numeroItem,
  );

  iniciarRunnerBackground(db, {
    sessaoId,
    organizacaoId,
    roboItemId: roboItemId.data,
    credencialId: credencialId.success && credencialId.data ? credencialId.data : null,
    urlDisputa,
  });

  redirect(`/robo/sessao/${sessaoId}`);
}

/** Para uma sessão em andamento (define estado = parado). */
export async function acaoParaSessao(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const sessaoId = z.uuid().safeParse(formData.get("sessaoId"));
  const voltar = destino(formData.get("voltar"), "/robo");
  if (!sessaoId.success) redirect(voltar);
  const db = await obterDb();
  await atualizarEstadoSessao(db, sessaoId.data, "parado", "Parado manualmente.");
  redirect(`/robo/sessao/${sessaoId.data}?ok=parado`);
}
