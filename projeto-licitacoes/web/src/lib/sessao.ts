import { redirect } from "next/navigation";
import { lerSessao, type SessaoAtiva } from "@/lib/auth";
import { obterDb } from "@/lib/dados/db";

export type Sessao = SessaoAtiva;

/**
 * Toda leitura ou escrita de dados de uma empresa passa por aqui: valida o
 * token da sessão no banco e devolve a organização de quem entrou. Sem sessão
 * válida, manda para /entrar. Nenhuma consulta usa organização vinda do navegador.
 */
export async function exigirOrganizacao(): Promise<Sessao> {
  const sessao = await lerSessao(await obterDb());
  if (!sessao) redirect("/entrar");
  return sessao;
}
