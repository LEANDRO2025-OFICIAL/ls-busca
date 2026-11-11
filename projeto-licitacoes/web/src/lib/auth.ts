import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import type { Db } from "@/lib/dados/db";

export const COOKIE_SESSAO = "sessao";
const DURACAO_SESSAO_MS = 30 * 86_400_000;
const PARAMETROS: ScryptOptions = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derivar(senha: string, sal: Buffer, tamanho: number, opcoes: ScryptOptions) {
  return new Promise<Buffer>((resolver, rejeitar) =>
    scrypt(senha.normalize("NFKC"), sal, tamanho, opcoes, (erro, chave) => (erro ? rejeitar(erro) : resolver(chave))),
  );
}

export async function gerarHash(senha: string) {
  const sal = randomBytes(16);
  const chave = await derivar(senha, sal, 64, PARAMETROS);
  return ["scrypt", PARAMETROS.N, PARAMETROS.r, PARAMETROS.p, sal.toString("base64"), chave.toString("base64")].join("$");
}

export async function conferirSenha(senha: string, armazenado: string) {
  const [algoritmo, N, r, p, sal, hash] = armazenado.split("$");
  if (algoritmo !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const chave = await derivar(senha, Buffer.from(sal, "base64"), esperado.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMETROS.maxmem,
  });
  return chave.length === esperado.length && timingSafeEqual(chave, esperado);
}

// Hash de uma senha qualquer: conferir contra ele quando o e-mail não existe deixa o
// tempo de resposta igual ao de uma senha errada (não revela quais e-mails têm conta).
let hashFalso: Promise<string> | null = null;
export function obterHashFalso() {
  hashFalso ??= gerarHash(randomBytes(16).toString("hex"));
  return hashFalso;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Só em Server Actions ou Route Handlers (é onde o Next permite gravar cookie). */
export async function criarSessao(db: Db, usuarioId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await db.execute(sql`insert into sessao (id, usuario_id, expira_em) values (${hashToken(token)}, ${usuarioId}, ${expiraEm})`);
  await db.execute(sql`delete from sessao where usuario_id = ${usuarioId} and expira_em < now()`);
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export type SessaoAtiva = { usuarioId: string; organizacaoId: string; nome: string; email: string };

export async function lerSessao(db: Db): Promise<SessaoAtiva | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const r = await db.execute<{ usuario_id: string; organizacao_id: string; nome: string; email: string }>(sql`
    select s.usuario_id, u.organizacao_id, u.nome, u.email
      from sessao s join usuario u on u.id = s.usuario_id
     where s.id = ${hashToken(token)} and s.expira_em > now()
  `);
  const s = r.rows[0];
  return s ? { usuarioId: s.usuario_id, organizacaoId: s.organizacao_id, nome: s.nome, email: s.email } : null;
}

/** Id (sha256 do token) da sessão deste navegador, para preservá-la ao derrubar as outras. */
export async function idSessaoAtual() {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  return token ? hashToken(token) : null;
}

export async function encerrarSessao(db: Db) {
  const loja = await cookies();
  const token = loja.get(COOKIE_SESSAO)?.value;
  if (token) await db.execute(sql`delete from sessao where id = ${hashToken(token)}`);
  loja.delete(COOKIE_SESSAO);
}
