import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { obterDb } from "@/lib/dados/db";
import { sincronizarAlpha, sincronizarBeta } from "@/lib/fontes/sincronizador";

// Rodado por cron externo (ex: cron-job.org a cada 60min).
// Requer header Authorization: Bearer <CRON_SECRET>.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const db = await obterDb();

  const orgs = await db.execute<{ organizacao_id: string; fonte: string }>(sql`
    select organizacao_id, fonte from credencial_fonte where status in ('ativa', 'pendente')
  `);

  const resultados = [];
  for (const row of orgs.rows) {
    const r = row.fonte === "alpha"
      ? await sincronizarAlpha(db, row.organizacao_id).catch((e: Error) => ({
          fonte: "alpha" as const, ok: false, erro: e.message, licitacoesIngeridas: 0, resumo: null,
        }))
      : await sincronizarBeta(db, row.organizacao_id).catch((e: Error) => ({
          fonte: "beta" as const, ok: false, erro: e.message, licitacoesIngeridas: 0, resumo: null,
        }));
    resultados.push({ org: row.organizacao_id, ...r });
  }

  return NextResponse.json({ ok: true, rodou: new Date().toISOString(), resultados });
}
