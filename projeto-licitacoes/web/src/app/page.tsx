import { redirect } from "next/navigation";
import { connection } from "next/server";
import { lerSessao } from "@/lib/auth";
import { obterDb } from "@/lib/dados/db";

export const instant = false;

// Visitante sem sessão → página de apresentação.
// Usuário logado → app.
export default async function Home() {
  await connection();
  const db = await obterDb();
  const sessao = await lerSessao(db);
  redirect(sessao ? "/inicio" : "/apresentacao");
}
