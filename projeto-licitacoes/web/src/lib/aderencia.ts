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

/** Um fator que contribuiu para a nota, com seu peso e uma explicação em português. */
export type MotivoAderencia = {
  fator: "termo" | "localidade" | "modalidade" | "valor" | "historico";
  peso: number;
  detalhe: string;
};

/** nota ∈ [0, 100]; soma dos pesos dos motivos == nota. */
export type Aderencia = {
  nota: number;
  motivos: MotivoAderencia[];
};

/**
 * Nota de 0 a 100 de quanto a licitação combina com o ramo, com os motivos auditáveis.
 * Invariante: sum(motivos[i].peso) === nota.
 */
export function calcularAderencia(s: SinaisAderencia, uf: string, modalidade: string): Aderencia | null {
  if (s.totalTermos === 0) return null;
  if (s.excluidosCasados.length > 0) {
    return {
      nota: 0,
      motivos: [{ fator: "termo", peso: 0, detalhe: `contém termo excluído: ${s.excluidosCasados.join(", ")}` }],
    };
  }

  const motivos: MotivoAderencia[] = [];
  let pontos = 0;

  if (s.termosCasados.length > 0) {
    const peso = Math.min(80, 50 + 15 * (s.termosCasados.length - 1));
    pontos += peso;
    motivos.push({
      fator: "termo",
      peso,
      detalhe: `contém ${s.termosCasados.map((t) => `"${t}"`).join(", ")}`,
    });
  }

  if (s.ufNoPerfil !== false) {
    pontos += 10;
    motivos.push({
      fator: "localidade",
      peso: 10,
      detalhe: s.ufNoPerfil ? `UF atendida: ${uf}` : "sem restrição de UF",
    });
  }

  if (s.modalidadeNoPerfil !== false) {
    pontos += 10;
    motivos.push({
      fator: "modalidade",
      peso: 10,
      detalhe: s.modalidadeNoPerfil ? `modalidade escolhida: ${modalidade}` : "sem restrição de modalidade",
    });
  }

  const nota = s.termosCasados.length > 0 ? Math.min(100, pontos) : Math.min(20, pontos);

  // Ajusta os pesos proporcionalmente para garantir que a soma == nota.
  const somaBruta = motivos.reduce((acc, m) => acc + m.peso, 0);
  if (somaBruta > 0 && somaBruta !== nota) {
    const fator = nota / somaBruta;
    for (const m of motivos) m.peso = Math.round(m.peso * fator);
    // Corrige arredondamento no primeiro motivo.
    const diff = nota - motivos.reduce((acc, m) => acc + m.peso, 0);
    if (motivos.length > 0) motivos[0].peso += diff;
  }

  return { nota, motivos };
}

/**
 * Converte a nota de aderência (0 a 100) na faixa mostrada ao usuário.
 * null = a empresa ainda não cadastrou o ramo.
 */
export function faixaAderencia(nota: number | null): Faixa {
  if (nota == null) return "sem-perfil";
  if (nota >= 70) return "alta";
  if (nota >= 40) return "media";
  return "baixa";
}
