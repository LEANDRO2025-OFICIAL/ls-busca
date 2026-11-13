import { NextResponse, type NextRequest } from "next/server";
import { lerSessao, type SessaoAtiva } from "@/lib/auth";
import type { Db } from "@/lib/dados/db";
import { obterDb } from "@/lib/dados/db";
import { situacaoDaOrganizacao } from "@/lib/dados/licenca";
import { permitir, statusDeAutorizacao } from "@/lib/protecao-api";

type Autorizado = { ok: true; db: Db; sessao: SessaoAtiva };
type Negado = { ok: false; resposta: NextResponse };

/**
 * Porta única das rotas de dados (route handlers): exige sessão válida (401 sem ela) e licença
 * vigente da organização (403 sem ela). Tudo conferido no servidor. Opcionalmente aplica um
 * limite de requisições por sessão (em memória, por instância) e devolve 429 ao estourar.
 */
export async function autorizarApi(
  req: NextRequest,
  limite?: { max: number; janelaMs: number },
): Promise<Autorizado | Negado> {
  const db = await obterDb();
  const sessao = await lerSessao(db);
  const temSessao = Boolean(sessao);
  const situacao = sessao ? await situacaoDaOrganizacao(db, sessao.organizacaoId) : null;
  const status = statusDeAutorizacao(temSessao, situacao?.liberado ?? false);
  if (status === 401) return { ok: false, resposta: NextResponse.json({ erro: "Entre para continuar." }, { status: 401 }) };
  if (status === 403) return { ok: false, resposta: NextResponse.json({ erro: situacao?.motivo ?? "Sem licença válida." }, { status: 403 }) };

  if (limite) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const r = permitir(`${sessao!.usuarioId}:${ip}`, limite.max, limite.janelaMs);
    if (!r.ok) {
      return {
        ok: false,
        resposta: NextResponse.json(
          { erro: "Muitas requisições. Tente de novo em instantes." },
          { status: 429, headers: { "Retry-After": String(Math.ceil((r.reiniciaEm - Date.now()) / 1000)) } },
        ),
      };
    }
  }
  return { ok: true, db, sessao: sessao! };
}
