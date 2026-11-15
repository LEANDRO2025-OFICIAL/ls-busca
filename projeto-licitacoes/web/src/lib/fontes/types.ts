export type FonteId = "alpha" | "beta";

export const NOME_FONTE: Record<FonteId, string> = {
  alpha: "Fonte Alpha",
  beta: "Fonte Beta",
};

export type LicitacaoExterna = {
  fonte: FonteId;
  idExterno: string;
  objeto: string;
  orgao: string;
  uf: string | null;
  valorCentavos: number | null;
  dataAbertura: Date | null;
  dataEncerramento: Date | null;
  statusExt: string;
  linkExterno: string | null;
  cnaes: string[];
  bruto: Record<string, unknown>;
};

export type ResumoFonte = {
  totalAbertas: number | null;
  totalFavoritas: number | null;
  boletinsNaoLidos: number | null;
  notificacoesNaoLidas: number | null;
  capturadoEm: Date | null;
};

export type StatusConexao = {
  fonte: FonteId;
  status: "pendente" | "ativa" | "erro" | "desativada";
  tokenExpiraEm: Date | null;
  ultimaSinc: Date | null;
  ultimoErro: string | null;
};

export type ResultadoSync = {
  fonte: FonteId;
  ok: boolean;
  licitacoesIngeridas: number;
  resumo: ResumoFonte | null;
  erro?: string;
};
