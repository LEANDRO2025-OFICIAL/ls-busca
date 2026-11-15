import { sql } from "drizzle-orm";
import { avaliarLicenca, ehEstadoLicenca, type EstadoLicenca, type Situacao } from "@/lib/licenca";
import { ehPlano, type Plano } from "@/lib/planos";
import type { Db } from "./db";

type LinhaLicenca = {
  licenca_estado: string;
  trial_fim: Date | string | null;
  licenca_expira_em: Date | string | null;
};

function emData(v: Date | string | null): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

/** Situação de acesso da organização, calculada no servidor a cada pedido. Org inexistente = bloqueada. */
export async function situacaoDaOrganizacao(db: Db, organizacaoId: string, agora: Date = new Date()): Promise<Situacao> {
  const r = await db.execute<LinhaLicenca>(sql`
    select licenca_estado, trial_fim, licenca_expira_em from organizacao where id = ${organizacaoId}
  `);
  const linha = r.rows[0];
  const estado: EstadoLicenca = ehEstadoLicenca(linha?.licenca_estado) ? linha.licenca_estado : "bloqueada";
  return avaliarLicenca(
    { estado, trialFim: emData(linha?.trial_fim ?? null), licencaExpiraEm: emData(linha?.licenca_expira_em ?? null) },
    agora,
  );
}

export type OrganizacaoLicenca = {
  id: string;
  nome: string;
  cnpj: string | null;
  estado: EstadoLicenca;
  plano: Plano;
  trialInicio: Date | null;
  trialFim: Date | null;
  licencaExpiraEm: Date | null;
  observacao: string | null;
  atualizadaEm: Date | null;
  criadaEm: Date | null;
  membros: number;
  situacao: Situacao;
};

/** Lista todas as organizações com a licença e a situação calculada (só para o nível máximo). */
export async function listarOrganizacoes(db: Db, agora: Date = new Date()): Promise<OrganizacaoLicenca[]> {
  const r = await db.execute<{
    id: string;
    nome: string;
    cnpj: string | null;
    licenca_estado: string;
    plano: string;
    trial_inicio: Date | string | null;
    trial_fim: Date | string | null;
    licenca_expira_em: Date | string | null;
    licenca_observacao: string | null;
    licenca_atualizada_em: Date | string | null;
    created_at: Date | string | null;
    membros: string | number;
  }>(sql`
    select o.id, o.nome, o.cnpj, o.licenca_estado, o.plano, o.trial_inicio, o.trial_fim,
           o.licenca_expira_em, o.licenca_observacao, o.licenca_atualizada_em, o.created_at,
           (select count(*) from usuario u where u.organizacao_id = o.id) as membros
      from organizacao o
     order by o.created_at desc
  `);
  return r.rows.map((o) => {
    const estado: EstadoLicenca = ehEstadoLicenca(o.licenca_estado) ? o.licenca_estado : "bloqueada";
    const plano: Plano = ehPlano(o.plano) ? o.plano : "basico";
    const trialFim = emData(o.trial_fim);
    const licencaExpiraEm = emData(o.licenca_expira_em);
    return {
      id: o.id,
      nome: o.nome,
      cnpj: o.cnpj,
      estado,
      plano,
      trialInicio: emData(o.trial_inicio),
      trialFim,
      licencaExpiraEm,
      observacao: o.licenca_observacao,
      atualizadaEm: emData(o.licenca_atualizada_em),
      criadaEm: emData(o.created_at),
      membros: Number(o.membros ?? 0),
      situacao: avaliarLicenca({ estado, trialFim, licencaExpiraEm }, agora),
    };
  });
}

/**
 * Define o estado da licença e o plano de uma organização.
 * Só deve ser chamada por quem passou por exigirDonoSistema(). Valida o estado e a data.
 */
export async function definirLicenca(
  db: Db,
  organizacaoId: string,
  dados: { estado: EstadoLicenca; expiraEm: Date | null; observacao: string | null; plano: Plano },
): Promise<void> {
  // Em "ativa" guardamos a validade escolhida; nos demais estados a validade não se aplica.
  const expira = dados.estado === "ativa" ? dados.expiraEm : null;
  await db.execute(sql`
    update organizacao
       set licenca_estado = ${dados.estado},
           licenca_expira_em = ${expira},
           licenca_observacao = ${dados.observacao},
           plano = ${dados.plano},
           licenca_atualizada_em = now(),
           updated_at = now()
     where id = ${organizacaoId}
  `);
}

/** Retorna o plano atual da organização. Útil para gates de funcionalidade em Server Components. */
export async function planoOrganizacao(db: Db, organizacaoId: string): Promise<Plano> {
  const r = await db.execute<{ plano: string }>(sql`
    select plano from organizacao where id = ${organizacaoId}
  `);
  const p = r.rows[0]?.plano;
  return ehPlano(p) ? p : "basico";
}
