import { NextResponse } from "next/server";
import { obterDb } from "@/lib/dados/db";
import { sincronizarTodasFontes } from "@/lib/fontes/sincronizador";
import { exigirOrganizacao } from "@/lib/sessao";

export async function POST() {
  try {
    const { organizacaoId } = await exigirOrganizacao();
    const db = await obterDb();
    const resultados = await sincronizarTodasFontes(db, organizacaoId);
    return NextResponse.json({ ok: true, resultados });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
