export type Faixa = "alta" | "media" | "baixa" | "sem-perfil";

/** O que o banco descobriu ao cruzar a licitação com o ramo (ver lib/dados/busca.ts). */
export type SinaisAderencia = {
  totalTermos: number;
  termosCasados: string[];
  excluidosCasados: string[];
  /** null = o ramo não restringe UF/modalidade. */
  ufNoPerfil: boolean | null;
  modalidadeNoPerfil: boolean | null;
};

export type Aderencia = { pontuacao: number; motivos: string[] };

/**
 * Nota de 0 a 100 de quanto a licitação combina com o ramo, com os motivos.
 *
 * TODO(Leandro): regra inicial, para a tela funcionar. Ajuste pelo que você
 * vê no dia a dia de licitação (ex.: pesar mais o termo no objeto do que no
 * complemento, ou derrubar a nota quando falta pouco para encerrar).
 */
export function calcularAderencia(s: SinaisAderencia, uf: string, modalidade: string): Aderencia | null {
  if (s.totalTermos === 0) return null;
  if (s.excluidosCasados.length > 0) {
    return { pontuacao: 0, motivos: [`contém termo que você exclui: ${s.excluidosCasados.join(", ")}`] };
  }
  const motivos: string[] = [];
  let pontos = 0;
  if (s.termosCasados.length > 0) {
    pontos += Math.min(80, 50 + 15 * (s.termosCasados.length - 1));
    motivos.push(`contém ${s.termosCasados.map((t) => `"${t}"`).join(", ")}`);
  }
  if (s.ufNoPerfil !== false) {
    pontos += 10;
    if (s.ufNoPerfil) motivos.push(`UF atendida: ${uf}`);
  }
  if (s.modalidadeNoPerfil !== false) {
    pontos += 10;
    if (s.modalidadeNoPerfil) motivos.push(`modalidade escolhida: ${modalidade}`);
  }
  // Sem nenhum termo do ramo, UF e modalidade sozinhas nunca passam de "baixa".
  return { pontuacao: s.termosCasados.length > 0 ? Math.min(100, pontos) : Math.min(20, pontos), motivos };
}

/**
 * Converte a pontuação de aderência (0 a 100) na faixa mostrada ao usuário.
 * null = a empresa ainda não cadastrou o ramo.
 *
 * TODO(Leandro): definir os cortes. Os valores abaixo são provisórios, só para
 * a página /design renderizar. Eles decidem quando uma licitação aparece como
 * "Alta" (e, mais tarde, quando dispara alerta).
 */
export function faixaAderencia(pontuacao: number | null): Faixa {
  if (pontuacao == null) return "sem-perfil";
  if (pontuacao >= 70) return "alta";
  if (pontuacao >= 40) return "media";
  return "baixa";
}
