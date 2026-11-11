"use server";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { conferirSenha, criarSessao, encerrarSessao, gerarHash, obterHashFalso } from "@/lib/auth";
import { cadastroAberto } from "@/lib/dados/conta";
import { obterDb } from "@/lib/dados/db";

const LIMITE_TENTATIVAS = 5; // por e-mail, a cada 15 minutos

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2).max(120),
  empresa: z.string().trim().min(2).max(200),
  email: z.email().max(200).transform((e) => e.toLowerCase()),
  senha: z.string().min(10).max(200),
});

export async function acaoCadastrar(formData: FormData) {
  const dados = esquemaCadastro.safeParse({
    nome: formData.get("nome"),
    empresa: formData.get("empresa"),
    email: String(formData.get("email") ?? "").trim(),
    senha: formData.get("senha"),
  });
  if (!dados.success) redirect("/cadastrar?erro=dados");
  const { nome, empresa, email, senha } = dados.data;

  const db = await obterDb();
  if (!(await cadastroAberto(db))) redirect("/cadastrar?erro=fechado");
  const existente = await db.execute(sql`select 1 from usuario where email = ${email}`);
  if (existente.rows.length > 0) redirect("/cadastrar?erro=email");

  const hash = await gerarHash(senha);
  const usuarioId = randomUUID();
  await db.transaction(async (tx) => {
    const org = await tx.execute<{ id: string }>(sql`insert into organizacao (nome) values (${empresa}) returning id`);
    await tx.execute(sql`
      insert into usuario (id, organizacao_id, nome, email, papel)
      values (${usuarioId}, ${org.rows[0].id}, ${nome}, ${email}, 'dono')
    `);
    await tx.execute(sql`insert into credencial (usuario_id, hash_senha) values (${usuarioId}, ${hash})`);
  });
  await criarSessao(db, usuarioId);
  redirect("/inicio/ramo");
}

export async function acaoEntrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const senha = String(formData.get("senha") ?? "").slice(0, 200);
  const db = await obterDb();

  const tentativas = await db.execute<{ n: string | number }>(sql`
    select count(*) as n from tentativa_login
     where email = ${email} and created_at > now() - interval '15 minutes'
  `);
  if (Number(tentativas.rows[0]?.n ?? 0) >= LIMITE_TENTATIVAS) redirect("/entrar?erro=limite");

  const r = await db.execute<{ id: string; hash_senha: string }>(sql`
    select u.id, c.hash_senha from usuario u join credencial c on c.usuario_id = u.id where u.email = ${email}
  `);
  const conta = r.rows[0];
  const confere = await conferirSenha(senha, conta?.hash_senha ?? (await obterHashFalso()));
  if (!conta || !confere) {
    await db.execute(sql`insert into tentativa_login (email) values (${email})`);
    redirect("/entrar?erro=credenciais");
  }

  await db.execute(sql`delete from tentativa_login where email = ${email}`);
  await criarSessao(db, conta.id);
  redirect("/inicio");
}

export async function acaoSair() {
  await encerrarSessao(await obterDb());
  redirect("/entrar");
}
