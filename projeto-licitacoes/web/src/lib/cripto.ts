import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const chaveBase = process.env.ROBO_KEY ?? "robo-key-dev-nao-usar-em-producao!!";
const chave = scryptSync(chaveBase, "ls-busca-robo-v1", 32);

/** AES-256-GCM: retorna iv(16) + tag(16) + cifrado em base64. */
export function cifrarSenha(texto: string): string {
  const iv = randomBytes(16);
  const c = createCipheriv("aes-256-gcm", chave, iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

/** Inverte cifrarSenha. Lança se a chave for inválida ou o dado estiver corrompido. */
export function decifrarSenha(enc64: string): string {
  const buf = Buffer.from(enc64, "base64");
  const d = createDecipheriv("aes-256-gcm", chave, buf.subarray(0, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return Buffer.concat([d.update(buf.subarray(32)), d.final()]).toString("utf8");
}
