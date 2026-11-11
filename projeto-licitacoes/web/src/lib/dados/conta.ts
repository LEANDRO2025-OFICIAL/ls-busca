import { sql } from "drizzle-orm";
import type { Db } from "./db";

export type Membro = { id: string; nome: string; email: string; papel: string };

export async function obterConta(db: Db, organizacaoId: string, usuarioId: string) {
  const org = await db.execute<{ nome: string; cnpj: string | null; porte: string | null }>(
    sql`select nome, cnpj, porte from organizacao where id = ${organizacaoId}`,
  );
  const membros = await db.execute<Membro>(sql`
    select id, nome, email, papel from usuario where organizacao_id = ${organizacaoId} order by created_at
  `);
  const eu = membros.rows.find((m) => m.id === usuarioId);
  return {
    empresa: { nome: org.rows[0]?.nome ?? "", cnpj: org.rows[0]?.cnpj ?? null, porte: org.rows[0]?.porte ?? null },
    eu: eu ?? null,
    ehDono: eu?.papel === "dono",
    membros: membros.rows,
  };
}

/** Só quem criou a conta da empresa administra empresa e equipe. */
export async function ehDono(db: Db, organizacaoId: string, usuarioId: string) {
  const r = await db.execute(sql`
    select 1 from usuario where id = ${usuarioId} and organizacao_id = ${organizacaoId} and papel = 'dono'
  `);
  return r.rows.length > 0;
}

export async function salvarEmpresa(
  db: Db,
  organizacaoId: string,
  dados: { nome: string; cnpj: string | null; porte: string | null },
) {
  await db.execute(sql`
    update organizacao set nome = ${dados.nome}, cnpj = ${dados.cnpj}, porte = ${dados.porte}, updated_at = now()
     where id = ${organizacaoId}
  `);
}

export async function salvarMeuNome(db: Db, usuarioId: string, nome: string) {
  await db.execute(sql`update usuario set nome = ${nome} where id = ${usuarioId}`);
}

export async function lerHashSenha(db: Db, usuarioId: string) {
  const r = await db.execute<{ hash_senha: string }>(sql`select hash_senha from credencial where usuario_id = ${usuarioId}`);
  return r.rows[0]?.hash_senha ?? null;
}

/** Troca a senha e derruba as outras sessões: quem tinha a senha antiga perde o acesso. */
export async function gravarSenha(db: Db, usuarioId: string, hash: string, sessaoAtualId: string | null) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`update credencial set hash_senha = ${hash}, updated_at = now() where usuario_id = ${usuarioId}`);
    await tx.execute(sql`delete from sessao where usuario_id = ${usuarioId} and id is distinct from ${sessaoAtualId}`);
  });
}

/**
 * Cadastro público fechado: o sistema fica exposto na internet e novas pessoas entram pela
 * equipe (Configurações). Abre só na base vazia (primeira conta) ou com CADASTRO_ABERTO=1.
 */
export async function cadastroAberto(db: Db) {
  if (process.env.CADASTRO_ABERTO === "1") return true;
  const r = await db.execute(sql`select 1 from usuario limit 1`);
  return r.rows.length === 0;
}

export async function emailEmUso(db: Db, email: string) {
  const r = await db.execute(sql`select 1 from usuario where email = ${email}`);
  return r.rows.length > 0;
}

export async function adicionarMembro(
  db: Db,
  organizacaoId: string,
  dados: { id: string; nome: string; email: string; hash: string },
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into usuario (id, organizacao_id, nome, email, papel)
      values (${dados.id}, ${organizacaoId}, ${dados.nome}, ${dados.email}, 'membro')
    `);
    await tx.execute(sql`insert into credencial (usuario_id, hash_senha) values (${dados.id}, ${dados.hash})`);
  });
}

/** Remove um membro (nunca o dono). Sessões e credencial saem junto pelo on delete cascade. */
export async function removerMembro(db: Db, organizacaoId: string, membroId: string) {
  await db.execute(sql`
    delete from usuario where id = ${membroId} and organizacao_id = ${organizacaoId} and papel <> 'dono'
  `);
}
