// Categoria de um objeto de licitação por palavras-chave, só para rotular cartões.
// A ordem importa: vale a primeira regra que casar. Texto sem acento e em minúsculas.
const REGRAS: [string, RegExp][] = [
  ["Construção e obras", /\b(obras?|construcao|reforma|pavimentacao|engenharia|edificacao|drenagem|asfalt\w*)\b/],
  ["Saúde", /\b(medicamento\w*|hospitalar|saude|odontologic\w*|laboratorio|vacina\w*)\b/],
  ["Alimentação", /\b(alimenticio\w*|alimento\w*|merenda|refeic\w*|hortifruti)\b/],
  ["Tecnologia", /\b(software|computador\w*|informatica|tecnologia|notebook\w*|licenca\w*|impressora\w*)\b/],
  ["Veículos e combustíveis", /\b(veiculo\w*|combustiveis?|gasolina|diesel|pneu\w*|automotiv\w*|onibus)\b/],
  ["Serviços e consultoria", /\b(servicos?|consultoria|assessoria|manutencao|locacao|treinamento|capacitacao)\b/],
  ["Materiais e equipamentos", /\b(aquisicao|materiais?|equipamentos?|mobiliario|uniformes?)\b/],
];

export function categoriaDoObjeto(objeto: string): string {
  const texto = objeto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return REGRAS.find(([, regra]) => regra.test(texto))?.[0] ?? "Outros";
}
