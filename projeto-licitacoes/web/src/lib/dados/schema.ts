// Tipos do Drizzle para as tabelas usadas pela aplicação.
// A fonte da verdade da estrutura é src/db/migracoes/*.sql (validada em Postgres 17);
// aqui só descrevemos as colunas para consultas tipadas. Colunas geradas (busca)
// ficam de fora de propósito: nunca são escritas pela aplicação.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const criadoEm = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizacao = pgTable("organizacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
});

export const usuario = pgTable("usuario", {
  id: uuid("id").primaryKey(),
  organizacaoId: uuid("organizacao_id").notNull(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  papel: text("papel").notNull().default("membro"),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
});

export const modalidade = pgTable("modalidade", {
  id: integer("id").primaryKey(),
  nome: text("nome").notNull(),
});

export const licitacao = pgTable("licitacao", {
  numeroControlePncp: text("numero_controle_pncp").primaryKey(),
  cnpjOrgao: char("cnpj_orgao", { length: 14 }).notNull(),
  ano: integer("ano").notNull(),
  sequencial: integer("sequencial").notNull(),
  numeroCompra: text("numero_compra"),
  processo: text("processo"),
  objeto: text("objeto").notNull(),
  informacaoComplementar: text("informacao_complementar"),
  modalidadeId: integer("modalidade_id").notNull(),
  modoDisputaId: integer("modo_disputa_id"),
  modoDisputaNome: text("modo_disputa_nome"),
  situacaoId: smallint("situacao_id").notNull(),
  situacaoNome: text("situacao_nome").notNull(),
  srp: boolean("srp").notNull().default(false),
  valorEstimadoCentavos: bigint("valor_estimado_centavos", { mode: "number" }),
  dataAbertura: timestamp("data_abertura", { withTimezone: true }),
  dataEncerramento: timestamp("data_encerramento", { withTimezone: true }),
  dataPublicacao: timestamp("data_publicacao", { withTimezone: true }),
  dataAtualizacaoPncp: timestamp("data_atualizacao_pncp", { withTimezone: true }),
  uf: char("uf", { length: 2 }).notNull(),
  municipio: text("municipio"),
  codigoIbge: text("codigo_ibge"),
  orgaoNome: text("orgao_nome").notNull(),
  unidadeNome: text("unidade_nome"),
  linkOrigem: text("link_origem"),
  bruto: jsonb("bruto").notNull(),
  ingeridoEm: timestamp("ingerido_em", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: atualizadoEm(),
});

export const ingestaoFatia = pgTable("ingestao_fatia", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull(),
  modalidadeId: integer("modalidade_id").notNull(),
  uf: char("uf", { length: 2 }),
  janelaInicio: date("janela_inicio"),
  janelaFim: date("janela_fim").notNull(),
  proximaPagina: integer("proxima_pagina").notNull().default(1),
  totalPaginas: integer("total_paginas"),
  status: text("status").notNull().default("pendente"),
  tentativas: integer("tentativas").notNull().default(0),
  ultimoErro: text("ultimo_erro"),
  bloqueadaAte: timestamp("bloqueada_ate", { withTimezone: true }),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
});

export const acompanhamento = pgTable("acompanhamento", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: uuid("organizacao_id").notNull(),
  numeroControlePncp: text("numero_controle_pncp").notNull(),
  etapa: text("etapa").notNull().default("interesse"),
  prioridade: smallint("prioridade").notNull().default(2),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  responsavelId: uuid("responsavel_id"),
  prazoEtapa: timestamp("prazo_etapa", { withTimezone: true }),
  posicao: integer("posicao").notNull().default(0),
  versao: integer("versao").notNull().default(1),
  criadoPor: uuid("criado_por"),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
});

export const mudancaEtapa = pgTable("mudanca_etapa", {
  id: uuid("id").primaryKey().defaultRandom(),
  acompanhamentoId: uuid("acompanhamento_id").notNull(),
  de: text("de"),
  para: text("para").notNull(),
  usuarioId: uuid("usuario_id"),
  createdAt: criadoEm(),
});
