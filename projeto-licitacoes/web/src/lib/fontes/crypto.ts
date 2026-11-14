import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function chave(): Buffer {
  const k = process.env.FONTES_ENCRYPTION_KEY;
  if (!k) throw new Error("FONTES_ENCRYPTION_KEY não configurada");
  const buf = Buffer.from(k, "hex");
  if (buf.length !== 32) throw new Error("FONTES_ENCRYPTION_KEY deve ter 64 hex chars (256 bits)");
  return buf;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, chave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decifrar(cifrado: string): string {
  const partes = cifrado.split(":");
  if (partes.length !== 3) throw new Error("Formato de dado cifrado inválido");
  const iv = Buffer.from(partes[0], "base64");
  const tag = Buffer.from(partes[1], "base64");
  const enc = Buffer.from(partes[2], "base64");
  const d = createDecipheriv(ALGO, chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
