"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { definirLicenca } from "@/lib/dados/licenca";
import { obterDb } from "@/lib/dados/db";
import { exigirDonoSistema } from "@/lib/sessao";

// Ações da tela do nível máximo (dono do sistema): ativar/renovar, expirar ou bloquear a licença
// de uma organização. Toda ação confere exigirDonoSistema no servidor.

const esquema = z.object({
  organizacaoId: z.uuid(),
  estado: z.enum(["ativa", "expirada", "bloqueada"]),
  // <input type="date"> = "AAAA-MM-DD"; só vale para "ativa". Vazio = sem data de expiração.
  expiraEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  observacao: z.string().trim().max(300).optional(),
});

export async function acaoDefinirLicenca(formData: FormData) {
  await exigirDonoSistema();
  const dados = esquema.safeParse({
    organizacaoId: formData.get("organizacaoId"),
    estado: formData.get("estado"),
    expiraEm: String(formData.get("expiraEm") ?? ""),
    observacao: String(formData.get("observacao") ?? ""),
  });
  if (!dados.success) redirect("/sistema/licencas?erro=dados");

  const expiraEm =
    dados.data.estado === "ativa" && dados.data.expiraEm
      ? new Date(`${dados.data.expiraEm}T23:59:59-03:00`)
      : null;
  if (expiraEm && Number.isNaN(expiraEm.getTime())) redirect("/sistema/licencas?erro=dados");

  await definirLicenca(await obterDb(), dados.data.organizacaoId, {
    estado: dados.data.estado,
    expiraEm,
    observacao: dados.data.observacao?.trim() || null,
  });
  redirect("/sistema/licencas?ok=1");
}
