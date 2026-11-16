import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Chave de criptografia das credenciais de portal.
 * Em produção é OBRIGATÓRIA: sem ROBO_KEY o processo não sobe, em vez de cifrar com uma
 * chave pública conhecida (que estava no histórico do Git e não protegia nada).
 * Em desenvolvimento, a chave é derivada e aleatória por execução — as credenciais salvas
 * não são decifráveis depois de reiniciar, o que é o comportamento desejado para dev.
 */
function carregarChave(): Buffer {
  const base = process.env.ROBO_KEY;
  if (!base || base.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ROBO_KEY ausente ou com menos de 32 caracteres. Defina a variável antes de subir em produção. " +
          'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
      );
    }
    console.warn("[cripto] ROBO_KEY ausente: usando chave efêmera de desenvolvimento.");
    return scryptSync(randomBytes(32), "ls-busca-robo-dev", 32);
  }
  return scryptSync(base, "ls-busca-robo-v1", 32);
}

// Lazy singleton: só carrega na primeira chamada real, não no load do módulo.
// Necessário porque o Next.js avalia os módulos em NODE_ENV=production durante o build,
// e jogar aqui quebraria o build mesmo que ROBO_KEY esteja nas vars do servidor em Runtime.
let _chave: Buffer | undefined;
function getChave(): Buffer {
  if (!_chave) _chave = carregarChave();
  return _chave;
}

/** AES-256-GCM: retorna iv(16) + tag(16) + cifrado em base64. */
export function cifrarSenha(texto: string): string {
  const iv = randomBytes(16);
  const c = createCipheriv("aes-256-gcm", getChave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

/** Inverte cifrarSenha. Lança se a chave for inválida ou o dado estiver corrompido. */
export function decifrarSenha(enc64: string): string {
  const buf = Buffer.from(enc64, "base64");
  if (buf.length < 33) throw new Error("Conteúdo cifrado inválido (curto demais).");
  const d = createDecipheriv("aes-256-gcm", getChave(), buf.subarray(0, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return Buffer.concat([d.update(buf.subarray(32)), d.final()]).toString("utf8");
}
