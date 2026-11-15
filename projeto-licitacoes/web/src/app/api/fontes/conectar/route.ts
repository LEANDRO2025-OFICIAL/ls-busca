import { type NextRequest, NextResponse } from "next/server";
import { obterDb } from "@/lib/dados/db";
import { salvarCredencial, salvarTokenFonte } from "@/lib/dados/fontes";
import { sincronizarAlpha, sincronizarBeta } from "@/lib/fontes/sincronizador";
import { exigirOrganizacao } from "@/lib/sessao";
import type { FonteId } from "@/lib/fontes/types";

export async function POST(req: NextRequest) {
  try {
    const { organizacaoId } = await exigirOrganizacao();
    const body = await req.json() as Record<string, unknown>;
    const { fonte, login, senha, tokenManual } = body as {
      fonte: string; login: string; senha?: string; tokenManual?: string;
    };

    if (!["alpha", "beta"].includes(fonte)) {
      return NextResponse.json({ ok: false, erro: "Fonte inválida" }, { status: 400 });
    }

    const db = await obterDb();

    if (tokenManual && fonte === "alpha") {
      if (!login) return NextResponse.json({ ok: false, erro: "Login obrigatório" }, { status: 400 });
      await salvarCredencial(db, organizacaoId, "alpha" as FonteId, login, senha ?? "");
      await salvarTokenFonte(db, organizacaoId, "alpha" as FonteId, tokenManual, new Date(Date.now() + 23 * 60 * 60 * 1000));
      return NextResponse.json({ ok: true, mensagem: "Fonte Alpha conectada com token manual." });
    }

    if (!login || !senha) {
      return NextResponse.json({ ok: false, erro: "Login e senha obrigatórios" }, { status: 400 });
    }

    await salvarCredencial(db, organizacaoId, fonte as FonteId, login, senha);

    const resultado = fonte === "alpha"
      ? await sincronizarAlpha(db, organizacaoId)
      : await sincronizarBeta(db, organizacaoId);

    if (!resultado.ok) {
      return NextResponse.json({
        ok: false,
        erro: resultado.erro,
        precisaTokenManual: resultado.erro?.includes("ENDPOINT"),
      });
    }

    return NextResponse.json({
      ok: true,
      mensagem: `Fonte ${fonte === "alpha" ? "Alpha" : "Beta"} conectada com sucesso.`,
      resumo: resultado.resumo,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
