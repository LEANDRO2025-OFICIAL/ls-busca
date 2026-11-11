"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { obterDb } from "@/lib/dados/db";
import { salvarPerfil, UFS } from "@/lib/dados/perfil";
import { acompanhar, ETAPAS, moverCartao, type ResultadoMover } from "@/lib/dados/funil";
import { atualizarBusca, definirAlertaAtivo, marcarBuscaVista, removerBusca, salvarBusca } from "@/lib/dados/alertas";
import { adicionarPrazo, removerPrazo } from "@/lib/dados/prazos";
import { CHAVES_SALVAS, lerFiltros } from "@/lib/filtros-busca";
import { exigirOrganizacao } from "@/lib/sessao";

const esquemaAcompanhar = z.object({ numeroControle: z.string().min(10).max(80) });

export async function acaoAcompanhar(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const { numeroControle } = esquemaAcompanhar.parse({ numeroControle: formData.get("numeroControle") });
  await acompanhar(await obterDb(), organizacaoId, usuarioId, numeroControle);
  refresh();
}

/** Uma linha (ou vírgula, ou ponto e vírgula) por termo; sem repetidos; limites contra abuso. */
function termosDoTexto(valor: FormDataEntryValue | null) {
  const vistos = new Set<string>();
  for (const bruto of String(valor ?? "").split(/[\n,;]+/)) {
    const termo = bruto.trim().replace(/\s+/g, " ").slice(0, 60);
    if (termo.length >= 2) vistos.add(termo);
  }
  return [...vistos].slice(0, 40);
}

export async function acaoSalvarPerfil(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const ufs = formData.getAll("uf").map(String).filter((u) => (UFS as readonly string[]).includes(u));
  const modalidades = formData
    .getAll("modalidade")
    .map((m) => Number.parseInt(String(m), 10))
    .filter((m) => Number.isInteger(m) && m > 0 && m < 100);
  await salvarPerfil(await obterDb(), organizacaoId, {
    termos: termosDoTexto(formData.get("termos")),
    termosExcluidos: termosDoTexto(formData.get("excluidos")),
    ufs: [...new Set(ufs)],
    modalidades: [...new Set(modalidades)],
  });
  redirect("/buscar?ramo=1");
}

const esquemaPrazo = z.object({
  acompanhamentoId: z.uuid(),
  titulo: z.string().trim().min(2).max(120),
  // <input type="datetime-local">: "2026-10-20T14:00", lido como horário de Brasília.
  quando: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

export async function acaoAdicionarPrazo(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const dados = esquemaPrazo.safeParse({
    acompanhamentoId: formData.get("acompanhamentoId"),
    titulo: formData.get("titulo"),
    quando: formData.get("quando"),
  });
  const quando = dados.success ? new Date(`${dados.data.quando}:00-03:00`) : null;
  if (!dados.success || !quando || Number.isNaN(quando.getTime())) redirect("/funil/prazos?erro=dados");
  await adicionarPrazo(await obterDb(), organizacaoId, { ...dados.data, quando });
  redirect("/funil/prazos?ok=1");
}

export async function acaoRemoverPrazo(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  const id = z.uuid().parse(formData.get("prazoId"));
  await removerPrazo(await obterDb(), organizacaoId, id);
  refresh();
}

/**
 * Cria (ou, com "id", edita) um alerta de busca ou um interesse da comunidade (tipo=comunidade).
 * Serve à tela de busca ("Salvar alerta") e aos formulários de /alertas e /comunidade.
 */
export async function acaoSalvarBusca(formData: FormData) {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const tipo = formData.get("tipo") === "comunidade" ? "comunidade" : "busca";
  const destino = tipo === "comunidade" ? "/comunidade" : "/alertas";
  const nome = z.string().trim().min(1).max(120).safeParse(formData.get("nome"));
  const id = z.uuid().safeParse(formData.get("id"));
  // Passa pelos mesmos validadores da tela de busca: só sobra o que a busca entende.
  const chaves = CHAVES_SALVAS.filter((c) => tipo === "busca" || ["uf", "mun", "mod", "vmin", "vmax"].includes(c));
  const { atuais } = lerFiltros(Object.fromEntries(chaves.map((c) => [c, String(formData.get(c) ?? "")])));
  const parametros = Object.fromEntries(chaves.filter((c) => atuais[c]).map((c) => [c, atuais[c]]));
  // Alerta de busca sem nenhum filtro avisaria de tudo; o interesse da comunidade já tem o piso de valor.
  if (!nome.success || (tipo === "busca" && Object.keys(parametros).length === 0)) redirect(`${destino}?erro=dados`);
  const db = await obterDb();
  if (id.success) await atualizarBusca(db, organizacaoId, id.data, { nome: nome.data, parametros });
  else await salvarBusca(db, organizacaoId, usuarioId, { nome: nome.data, parametros }, tipo);
  redirect(`${destino}?ok=${id.success ? "editado" : "criado"}`);
}

export async function acaoDefinirAlertaAtivo(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  await definirAlertaAtivo(await obterDb(), organizacaoId, z.uuid().parse(formData.get("id")), formData.get("ativo") === "1");
  refresh();
}

export async function acaoMarcarBuscaVista(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  await marcarBuscaVista(await obterDb(), organizacaoId, z.uuid().parse(formData.get("id")));
  refresh();
}

export async function acaoRemoverBusca(formData: FormData) {
  const { organizacaoId } = await exigirOrganizacao();
  await removerBusca(await obterDb(), organizacaoId, z.uuid().parse(formData.get("id")));
  refresh();
}

const esquemaMover = z.object({
  id: z.uuid(),
  etapa: z.enum(ETAPAS),
  versao: z.number().int().positive(),
});

export async function acaoMoverCartao(entrada: { id: string; etapa: string; versao: number }): Promise<ResultadoMover> {
  const { organizacaoId, usuarioId } = await exigirOrganizacao();
  const dados = esquemaMover.parse(entrada);
  return moverCartao(await obterDb(), organizacaoId, usuarioId, dados);
}
