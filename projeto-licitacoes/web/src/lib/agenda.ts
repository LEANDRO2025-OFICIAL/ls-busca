// Calendário de prazos: tipos, grade do mês/semana e exportação .ics. Lógica pura (sem banco e
// sem imports), coberta por testes (node --test importa este arquivo direto).
// Os dias são sempre os do horário de Brasília, que não tem horário de verão (UTC-3).

export const TIPOS_PRAZO = ["proposta", "sessao", "recurso", "outros"] as const;
export type TipoPrazo = (typeof TIPOS_PRAZO)[number];

export const NOME_TIPO_PRAZO: Record<TipoPrazo, string> = {
  proposta: "Proposta",
  sessao: "Sessão",
  recurso: "Recurso",
  outros: "Outros",
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Fim das propostas do PNCP é sempre "proposta"; os prazos da equipe são classificados pelo título. */
export function tipoDoPrazo(p: { tipo: "encerramento" | "manual"; titulo: string }): TipoPrazo {
  if (p.tipo === "encerramento") return "proposta";
  const t = semAcento(p.titulo);
  if (/\b(recurso|recursal|contrarraz|impugna)/.test(t)) return "recurso";
  if (/\b(sessao|disputa|lance|pregao|abertura)/.test(t)) return "sessao";
  if (/\bproposta/.test(t)) return "proposta";
  return "outros";
}

const DESLOCAMENTO_BRASILIA_MS = 3 * 3_600_000;
const dois = (n: number) => String(n).padStart(2, "0");

/** Dia (AAAA-MM-DD) de um instante no horário de Brasília. */
export function diaDeBrasilia(quando: Date): string {
  return new Date(quando.getTime() - DESLOCAMENTO_BRASILIA_MS).toISOString().slice(0, 10);
}

/** Lê AAAA-MM-DD; devolve null se não for uma data de verdade. */
export function lerDia(texto: string | undefined): string | null {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const d = new Date(`${texto}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto ? null : texto;
}

/** Soma dias a um AAAA-MM-DD. */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mesmo dia em outro mês (limitado ao último dia do mês de destino). */
export function somarMeses(dia: string, n: number): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return `${alvo.getUTCFullYear()}-${dois(alvo.getUTCMonth() + 1)}-${dois(Math.min(d, ultimo))}`;
}

/** Os 7 dias (domingo a sábado) da semana que contém o dia. */
export function diasDaSemana(dia: string): string[] {
  const inicio = somarDias(dia, -new Date(`${dia}T00:00:00Z`).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

/** Semanas completas (domingo a sábado) que cobrem o mês do dia; inclui dias dos meses vizinhos. */
export function semanasDoMes(dia: string): string[][] {
  const primeiro = `${dia.slice(0, 8)}01`;
  const ultimo = somarDias(somarMeses(primeiro, 1), -1);
  const semanas: string[][] = [];
  for (let s = diasDaSemana(primeiro); s[0] <= ultimo; s = diasDaSemana(somarDias(s[0], 7))) semanas.push(s);
  return semanas;
}

/** Agrupa por dia de Brasília, mantendo a ordem de chegada. */
export function agruparPorDia<T extends { quando: Date }>(eventos: T[]): Map<string, T[]> {
  const porDia = new Map<string, T[]>();
  for (const e of eventos) {
    const dia = diaDeBrasilia(e.quando);
    porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  }
  return porDia;
}

// ---------------------------------------------------------------------------
// Exportação iCalendar (RFC 5545)
// ---------------------------------------------------------------------------

export type EventoIcs = {
  id: string;
  titulo: string;
  quando: Date;
  tipo: TipoPrazo;
  descricao?: string;
  url?: string;
};

const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const instante = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Quebra linhas com mais de 75 octetos (a continuação começa com um espaço), sem partir caracteres. */
function dobrar(linha: string): string {
  const codificador = new TextEncoder();
  const partes: string[] = [];
  let atual = "";
  let octetos = 0;
  for (const caractere of linha) {
    const tamanho = codificador.encode(caractere).length;
    if (octetos + tamanho > (partes.length === 0 ? 75 : 74)) {
      partes.push(atual);
      atual = "";
      octetos = 0;
    }
    atual += caractere;
    octetos += tamanho;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

/** Arquivo .ics com um evento por prazo (horários em UTC; o aplicativo de agenda converte). */
export function gerarIcs(eventos: EventoIcs[], agora: Date, nome = "Prazos de licitações"): string {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LS Busca//Prazos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(nome)}`,
  ];
  for (const e of eventos) {
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${escapar(e.id)}@ls-busca`,
      `DTSTAMP:${instante(agora)}`,
      `DTSTART:${instante(e.quando)}`,
      `DTEND:${instante(e.quando)}`,
      `SUMMARY:${escapar(`${NOME_TIPO_PRAZO[e.tipo]}: ${e.titulo}`)}`,
      `CATEGORIES:${escapar(NOME_TIPO_PRAZO[e.tipo])}`,
    );
    if (e.descricao) linhas.push(`DESCRIPTION:${escapar(e.descricao)}`);
    if (e.url) linhas.push(`URL:${e.url}`);
    linhas.push("END:VEVENT");
  }
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}
