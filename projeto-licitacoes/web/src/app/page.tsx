import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { obterDb } from "@/lib/dados/db";

// Visitante sem sessão → página de apresentação.
// Usuário logado → app.
export default async function Home() {
  const db = await obterDb();
  const sessao = await lerSessao(db);
  redirect(sessao ? "/inicio" : "/apresentacao");
}
