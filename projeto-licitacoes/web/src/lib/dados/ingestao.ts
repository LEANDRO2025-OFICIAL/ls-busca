import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "./db";
import { buscarPropostasAbertas, paraLinhaLicitacao, type CompraPncp } from "./pncp";
import { ingestaoFatia, licitacao, modalidade } from "./schema";

const DIA_MS = 86_400_000;
// Abaixo do limite de taxa do PNCP (ver pncp.ts).
const PAUSA_ENTRE_PAGINAS_MS = 2_500;

/**
 * Códigos de modalidade com proposta aberta no PNCP, do maior volume para o menor
 * (sondagem de 2026-10-18: 6 pregão eletrônico ~17,3 mil; 12 credenciamento ~4 mil;
 * 4 concorrência eletrônica ~4 mil; 8 dispensa ~3,4 mil; demais abaixo de 300).
 * O código 2 (diálogo competitivo) não tinha registros e fica de fora.
 */
export const MODALIDADES_COM_PROPOSTA = [6, 12, 4, 8, 5, 7, 1, 11, 13, 3, 10, 9] as const;
const MAX_TENTATIVAS = 5;

function isoDia(data: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

/**
 * Cria (ou reabre) a fatia do ciclo. Uma fatia = endpoint + modalidade + UF + janela.
 * Reabre a fatia concluída há mais de 3 horas, para pegar o que entrou depois.
 */
export async function semear(db: Db, opcoes: { modalidade: number; uf: string | null; agora?: Date }) {
  const agora = opcoes.agora ?? new Date();
  const janelaFim = isoDia(new Date(agora.getTime() + 120 * DIA_MS));
  await db
    .insert(ingestaoFatia)
    .values({ endpoint: "proposta", modalidadeId: opcoes.modalidade, uf: opcoes.uf, janelaFim })
    .onConflictDoUpdate({
      target: [
        ingestaoFatia.endpoint,
        ingestaoFatia.modalidadeId,
        ingestaoFatia.uf,
        ingestaoFatia.janelaInicio,
        ingestaoFatia.janelaFim,
      ],
      set: { status: "pendente", proximaPagina: 1, tentativas: 0, ultimoErro: null },
      setWhere: sql`${ingestaoFatia.status} = 'concluida' and ${ingestaoFatia.updatedAt} < now() - interval '3 hours'`,
    });
}

export type ResultadoIngestao = {
  fatias: number;
  paginas: number;
  registros: number;
  erros: string[];
  parouPorTempo: boolean;
};

/** Processa fatias pendentes até acabar o orçamento de tempo; retoma de onde parou na próxima chamada. */
export async function ingerir(db: Db, opcoes: { orcamentoMs: number }): Promise<ResultadoIngestao> {
  const limite = Date.now() + opcoes.orcamentoMs;
  const resultado: ResultadoIngestao = { fatias: 0, paginas: 0, registros: 0, erros: [], parouPorTempo: false };

  while (Date.now() < limite) {
    const [fatia] = await db
      .select()
      .from(ingestaoFatia)
      .where(
        and(
          or(
            inArray(ingestaoFatia.status, ["pendente", "rodando"]),
            and(eq(ingestaoFatia.status, "erro"), lt(ingestaoFatia.tentativas, MAX_TENTATIVAS)),
          ),
          or(isNull(ingestaoFatia.bloqueadaAte), lt(ingestaoFatia.bloqueadaAte, sql`now()`)),
        ),
      )
      .orderBy(asc(ingestaoFatia.createdAt))
      .limit(1);
    if (!fatia) break;

    resultado.fatias++;
    await db
      .update(ingestaoFatia)
      .set({ status: "rodando", bloqueadaAte: sql`now() + interval '5 minutes'` })
      .where(eq(ingestaoFatia.id, fatia.id));

    let pagina = fatia.proximaPagina;
    try {
      while (Date.now() < limite) {
        const resposta = await buscarPropostasAbertas({
          dataFinal: fatia.janelaFim.replaceAll("-", ""),
          modalidade: fatia.modalidadeId,
          uf: fatia.uf ?? undefined,
          pagina,
        });
        await gravarPagina(db, resposta.data);
        resultado.paginas++;
        resultado.registros += resposta.data.length;

        const acabou = resposta.data.length === 0 || pagina >= resposta.totalPaginas;
        await db
          .update(ingestaoFatia)
          .set({
            proximaPagina: acabou ? pagina : pagina + 1,
            totalPaginas: resposta.totalPaginas,
            status: acabou ? "concluida" : "rodando",
            bloqueadaAte: acabou ? null : sql`now() + interval '5 minutes'`,
            ultimoErro: null,
          })
          .where(eq(ingestaoFatia.id, fatia.id));
        if (acabou) break;
        pagina++;
        await new Promise((r) => setTimeout(r, PAUSA_ENTRE_PAGINAS_MS));
      }
      if (Date.now() >= limite) {
        resultado.parouPorTempo = true;
        // Parou por tempo, não por falha: solta a trava para a próxima chamada retomar já.
        await db
          .update(ingestaoFatia)
          .set({ bloqueadaAte: null })
          .where(and(eq(ingestaoFatia.id, fatia.id), eq(ingestaoFatia.status, "rodando")));
      }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      resultado.erros.push(mensagem);
      await db
        .update(ingestaoFatia)
        .set({ status: "erro", tentativas: sql`${ingestaoFatia.tentativas} + 1`, ultimoErro: mensagem, bloqueadaAte: null })
        .where(eq(ingestaoFatia.id, fatia.id));
    }
  }
  return resultado;
}

async function gravarPagina(db: Db, compras: CompraPncp[]) {
  if (compras.length === 0) return;
  await db.transaction(async (tx) => {
    const modalidades = new Map(compras.map((c) => [c.modalidadeId, c.modalidadeNome]));
    await tx
      .insert(modalidade)
      .values([...modalidades].map(([id, nome]) => ({ id, nome })))
      .onConflictDoUpdate({ target: modalidade.id, set: { nome: sql`excluded.nome` } });

    await tx
      .insert(licitacao)
      .values(compras.map(paraLinhaLicitacao))
      .onConflictDoUpdate({
        target: licitacao.numeroControlePncp,
        set: {
          objeto: sql`excluded.objeto`,
          informacaoComplementar: sql`excluded.informacao_complementar`,
          modalidadeId: sql`excluded.modalidade_id`,
          modoDisputaId: sql`excluded.modo_disputa_id`,
          modoDisputaNome: sql`excluded.modo_disputa_nome`,
          situacaoId: sql`excluded.situacao_id`,
          situacaoNome: sql`excluded.situacao_nome`,
          srp: sql`excluded.srp`,
          valorEstimadoCentavos: sql`excluded.valor_estimado_centavos`,
          dataAbertura: sql`excluded.data_abertura`,
          dataEncerramento: sql`excluded.data_encerramento`,
          dataPublicacao: sql`excluded.data_publicacao`,
          dataAtualizacaoPncp: sql`excluded.data_atualizacao_pncp`,
          municipio: sql`excluded.municipio`,
          orgaoNome: sql`excluded.orgao_nome`,
          unidadeNome: sql`excluded.unidade_nome`,
          linkOrigem: sql`excluded.link_origem`,
          bruto: sql`excluded.bruto`,
          ingeridoEm: sql`now()`,
        },
      });
  });
}
