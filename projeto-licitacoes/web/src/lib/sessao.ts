import { notFound, redirect } from "next/navigation";
import { lerSessao, type SessaoAtiva } from "@/lib/auth";
import { obterDb } from "@/lib/dados/db";
import { situacaoDaOrganizacao } from "@/lib/dados/licenca";

export type Sessao = SessaoAtiva;

/**
 * Toda leitura ou escrita de dados de uma empresa passa por aqui: valida o token da sessão no banco
 * e devolve a organização de quem entrou. Nenhuma consulta usa organização vinda do navegador.
 *
 * Por padrão também exige licença válida (avaliação vigente ou licença ativa) e, se não houver,
 * manda para /bloqueio — é o ponto único que protege páginas, Server Actions e o sino. As poucas
 * telas que precisam funcionar bloqueadas (a própria /bloqueio e a tela do dono do sistema) chamam
 * com { exigirLicenca: false }. A verificação é sempre no servidor.
 */
export async function exigirOrganizacao(opcoes?: { exigirLicenca?: boolean }): Promise<Sessao> {
  const db = await obterDb();
  const sessao = await lerSessao(db);
  if (!sessao) redirect("/entrar");
  if (opcoes?.exigirLicenca !== false) {
    const situacao = await situacaoDaOrganizacao(db, sessao.organizacaoId);
    if (!situacao.liberado) redirect("/bloqueio");
  }
  return sessao;
}

/** Quem são os donos do sistema (nível máximo). Lista de e-mails em EMAIL_DONO_SISTEMA, separados por vírgula. */
export function emailsDonoSistema(): string[] {
  return (process.env.EMAIL_DONO_SISTEMA ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function ehEmailDonoSistema(email: string): boolean {
  return emailsDonoSistema().includes(email.trim().toLowerCase());
}

/**
 * Exige sessão de um dono do sistema (nível máximo), não de dono de órgão comum. Quem não for
 * recebe 404 (a tela nem revela que existe). Não exige licença: o dono precisa administrar mesmo
 * que a própria organização esteja em avaliação.
 */
export async function exigirDonoSistema(): Promise<Sessao> {
  const sessao = await exigirOrganizacao({ exigirLicenca: false });
  if (!ehEmailDonoSistema(sessao.email)) notFound();
  return sessao;
}
