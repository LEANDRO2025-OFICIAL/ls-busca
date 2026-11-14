import { autenticarAlpha, buscarLicitacoesAlpha, buscarResumoAlpha, validarTokenAlpha } from "./fonte-alpha";
import { autenticarBeta, buscarResumoBeta, type SessaoBeta } from "./fonte-beta";
import { lerCredencial, marcarErroFonte, salvarResumoFonte, salvarTokenFonte, upsertLicitacaoExterna } from "@/lib/dados/fontes";
import type { FonteId, ResultadoSync } from "./types";
import type { Db } from "@/lib/dados/db";

export async function sincronizarAlpha(db: Db, organizacaoId: string): Promise<ResultadoSync> {
  try {
    const cred = await lerCredencial(db, organizacaoId, "alpha");
    if (!cred) {
      return { fonte: "alpha", ok: false, licitacoesIngeridas: 0, resumo: null, erro: "Sem credenciais configuradas" };
    }

    let token = cred.token;
    const expirou = !token || (cred.tokenExpiraEm != null && cred.tokenExpiraEm <= new Date());

    if (expirou) {
      if (!cred.senha) {
        return { fonte: "alpha", ok: false, licitacoesIngeridas: 0, resumo: null, erro: "Token expirado. Renove o token nas configurações." };
      }
      try {
        const { token: novoToken, expiraEm } = await autenticarAlpha(cred.login, cred.senha);
        await salvarTokenFonte(db, organizacaoId, "alpha", novoToken, expiraEm);
        token = novoToken;
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("ENDPOINT_NAO_ENCONTRADO")) {
          await marcarErroFonte(db, organizacaoId, "alpha", "Token expirado. Cole o novo token nas configurações.");
          return { fonte: "alpha", ok: false, licitacoesIngeridas: 0, resumo: null, erro: "Renove o token nas configurações." };
        }
        await marcarErroFonte(db, organizacaoId, "alpha", msg);
        return { fonte: "alpha", ok: false, licitacoesIngeridas: 0, resumo: null, erro: msg };
      }
    }

    if (!token || !(await validarTokenAlpha(token))) {
      await marcarErroFonte(db, organizacaoId, "alpha", "Token inválido ou expirado.");
      return { fonte: "alpha", ok: false, licitacoesIngeridas: 0, resumo: null, erro: "Token inválido. Renove nas configurações." };
    }

    const [resumo, licitacoes] = await Promise.all([
      buscarResumoAlpha(token),
      buscarLicitacoesAlpha(token).catch(() => []),
    ]);

    await salvarResumoFonte(db, organizacaoId, "alpha", resumo);
    const ingeridas = await upsertLicitacaoExterna(db, organizacaoId, licitacoes);
    return { fonte: "alpha", ok: true, licitacoesIngeridas: ingeridas, resumo };
  } catch (e) {
    const msg = (e as Error).message;
    await marcarErroFonte(db, organizacaoId, "alpha", msg).catch(() => {});
    return { fonte: "alpha", ok: false, licitacoesIngeridas: 0, resumo: null, erro: msg };
  }
}

export async function sincronizarBeta(db: Db, organizacaoId: string): Promise<ResultadoSync> {
  try {
    const cred = await lerCredencial(db, organizacaoId, "beta");
    if (!cred) {
      return { fonte: "beta", ok: false, licitacoesIngeridas: 0, resumo: null, erro: "Sem credenciais configuradas" };
    }

    let sessionJson = cred.token;
    const expirou = !sessionJson || (cred.tokenExpiraEm != null && cred.tokenExpiraEm <= new Date());

    if (expirou) {
      const { sessao, expiraEm } = await autenticarBeta(cred.login, cred.senha);
      sessionJson = JSON.stringify(sessao);
      await salvarTokenFonte(db, organizacaoId, "beta", sessionJson, expiraEm);
    }

    const sessao = JSON.parse(sessionJson!) as SessaoBeta;
    const resumo = await buscarResumoBeta(sessao);
    await salvarResumoFonte(db, organizacaoId, "beta", resumo);

    return { fonte: "beta", ok: true, licitacoesIngeridas: 0, resumo };
  } catch (e) {
    const msg = (e as Error).message;
    await marcarErroFonte(db, organizacaoId, "beta", msg).catch(() => {});
    return { fonte: "beta", ok: false, licitacoesIngeridas: 0, resumo: null, erro: msg };
  }
}

export async function sincronizarTodasFontes(
  db: Db,
  organizacaoId: string,
  fontes: FonteId[] = ["alpha", "beta"],
): Promise<ResultadoSync[]> {
  return Promise.all(
    fontes.map((f) => f === "alpha" ? sincronizarAlpha(db, organizacaoId) : sincronizarBeta(db, organizacaoId)),
  );
}
