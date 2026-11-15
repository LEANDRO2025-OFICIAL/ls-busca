import { sql, type SQL } from "drizzle-orm";
import { calcularAderencia } from "@/lib/aderencia";
import type { Db } from "./db";
import { listaTexto, type Perfil } from "./perfil";
import { buscarPropostasAbertas, dataBrasilia } from "./pncp";

export const POR_PAGINA = 20;

export type FiltrosBusca = {
  q: string;
  uf: string | null;
  /** Nome do município, sem diferenciar acento ou maiúsculas. */
  municipio?: string | null;
  modalidade: number | null;
  valorMinCentavos: number | null;
  valorMaxCentavos: number | null;
  encerraEmDias: number | null;
  pagina: number;
  /** Ramo da organização: liga a aderência e o recorte "meu ramo". */
  perfil: Perfil | null;
  apenasRamo: boolean;
  /** Só as que entraram na base depois desta data (alertas). */
  novasDesde?: Date | null;
  /** Nota mínima de aderência ao ramo (0 a 100); só vale com ramo cadastrado. */
  aderenciaMin?: number | null;
};

export type ResultadoLinha = {
  numeroControle: string;
  cnpj: string;
  ano: number;
  sequencial: number;
  objeto: string;
  orgao: string;
  municipio: string | null;
  uf: string;
  modalidade: string;
  valorCentavos: number | null;
  encerramento: Date | null;
  publicacao: Date | null;
  etapa: string | null;
  modalidadeId: number;
  termosCasados: string[];
  excluidosCasados: string[];
};

type LinhaBruta = {
  numero_controle_pncp: string;
  cnpj_orgao: string;
  ano: number;
  sequencial: number;
  objeto: string;
  orgao_nome: string;
  municipio: string | null;
  uf: string;
  modalidade: string;
  valor_estimado_centavos: string | number | null;
  data_encerramento: string | Date | null;
  data_publicacao: string | Date | null;
  etapa: string | null;
  modalidade_id: number;
  termos_casados: string[] | null;
  excluidos_casados: string[] | null;
  total: string | number;
};

/**
 * Licitações com proposta em aberto, com a etapa no funil da organização.
 * Texto: websearch_to_tsquery em português (aceita "frase", -excluir, or) e, para
 * órgão ou número do processo, busca parcial sem acento.
 */
export async function buscarLicitacoes(db: Db, organizacaoId: string, filtros: FiltrosBusca) {
  const condicoes: SQL[] = [sql`l.data_encerramento > now()`];
  const q = filtros.q.trim();
  const consulta = sql`websearch_to_tsquery('pt', ${q})`;
  if (q) {
    const parcial = `%${q.toLowerCase()}%`;
    const cnpj = q.replace(/\D/g, "");
    condicoes.push(sql`(
      l.busca @@ ${consulta}
      or ${cnpj.length === 14 ? sql`l.cnpj_orgao = ${cnpj}` : sql`false`}
      or f_unaccent(lower(l.orgao_nome)) like f_unaccent(${parcial})
      or f_unaccent(lower(coalesce(l.processo, ''))) like f_unaccent(${parcial})
    )`);
  }
  if (filtros.uf) condicoes.push(sql`l.uf = ${filtros.uf}`);
  if (filtros.municipio) {
    condicoes.push(sql`f_unaccent(lower(coalesce(l.municipio, ''))) = f_unaccent(lower(${filtros.municipio}))`);
  }
  if (filtros.modalidade) condicoes.push(sql`l.modalidade_id = ${filtros.modalidade}`);
  if (filtros.valorMinCentavos != null) condicoes.push(sql`l.valor_estimado_centavos >= ${filtros.valorMinCentavos}`);
  if (filtros.valorMaxCentavos != null) condicoes.push(sql`l.valor_estimado_centavos <= ${filtros.valorMaxCentavos}`);
  if (filtros.novasDesde) condicoes.push(sql`l.primeira_vez_em > ${filtros.novasDesde}`);
  if (filtros.encerraEmDias) {
    condicoes.push(sql`l.data_encerramento <= now() + make_interval(days => ${filtros.encerraEmDias})`);
  }

  // Cruzamento com o ramo: quais termos (e termos excluídos) aparecem em cada licitação.
  const perfil = filtros.perfil;
  const termos = listaTexto(perfil?.termos ?? []);
  const excluidos = listaTexto(perfil?.termosExcluidos ?? []);
  const casados = sql`array(select t from unnest(${termos}) t where l.busca @@ plainto_tsquery('pt', t))`;
  const excluidosCasados = sql`array(select t from unnest(${excluidos}) t where l.busca @@ plainto_tsquery('pt', t))`;

  if (filtros.apenasRamo && perfil && perfil.termos.length > 0) {
    condicoes.push(sql`cardinality(${casados}) > 0 and cardinality(${excluidosCasados}) = 0`);
    if (perfil.ufs.length) condicoes.push(sql`l.uf::text = any(${listaTexto(perfil.ufs)})`);
    if (perfil.modalidades.length) {
      condicoes.push(sql`l.modalidade_id = any(${listaTexto(perfil.modalidades.map(String))}::int[])`);
    }
  }

  if (filtros.aderenciaMin && perfil && perfil.termos.length > 0) {
    // Espelha calcularAderencia (lib/aderencia.ts): mudando a regra lá, mude aqui.
    const pontosUf = perfil.ufs.length ? sql`(case when l.uf::text = any(${listaTexto(perfil.ufs)}) then 10 else 0 end)` : sql`10`;
    const pontosModalidade = perfil.modalidades.length
      ? sql`(case when l.modalidade_id = any(${listaTexto(perfil.modalidades.map(String))}::int[]) then 10 else 0 end)`
      : sql`10`;
    condicoes.push(sql`(case
      when cardinality(${excluidosCasados}) > 0 then 0
      when cardinality(${casados}) > 0
        then least(100, least(80, 50 + 15 * (cardinality(${casados}) - 1)) + ${pontosUf} + ${pontosModalidade})
      else least(20, ${pontosUf} + ${pontosModalidade})
    end) >= ${filtros.aderenciaMin}`);
  }

  const ordem = q
    ? sql`ts_rank(l.busca, ${consulta}) desc, l.data_encerramento asc`
    : filtros.apenasRamo
      ? sql`cardinality(${casados}) desc, l.data_encerramento asc`
      : sql`l.data_encerramento asc`;

  const resultado = await db.execute<LinhaBruta>(sql`
    select l.numero_controle_pncp, l.cnpj_orgao, l.ano, l.sequencial, l.objeto, l.orgao_nome,
           l.municipio, l.uf, m.nome as modalidade, l.valor_estimado_centavos, l.data_encerramento,
           l.data_publicacao, a.etapa, l.modalidade_id, ${casados} as termos_casados, ${excluidosCasados} as excluidos_casados,
           count(*) over () as total
      from licitacao l
      join modalidade m on m.id = l.modalidade_id
      left join acompanhamento a
        on a.numero_controle_pncp = l.numero_controle_pncp and a.organizacao_id = ${organizacaoId}
     where ${sql.join(condicoes, sql` and `)}
     order by ${ordem}
     limit ${POR_PAGINA} offset ${(filtros.pagina - 1) * POR_PAGINA}
  `);

  const linhas = resultado.rows;
  return {
    total: linhas.length ? Number(linhas[0].total) : 0,
    linhas: linhas.map(
      (r): ResultadoLinha => ({
        numeroControle: r.numero_controle_pncp,
        cnpj: r.cnpj_orgao,
        ano: r.ano,
        sequencial: r.sequencial,
        objeto: r.objeto,
        orgao: r.orgao_nome,
        municipio: r.municipio,
        uf: r.uf,
        modalidade: r.modalidade,
        valorCentavos: r.valor_estimado_centavos == null ? null : Number(r.valor_estimado_centavos),
        encerramento: r.data_encerramento == null ? null : new Date(r.data_encerramento),
        publicacao: r.data_publicacao == null ? null : new Date(r.data_publicacao),
        etapa: r.etapa,
        modalidadeId: r.modalidade_id,
        termosCasados: r.termos_casados ?? [],
        excluidosCasados: r.excluidos_casados ?? [],
      }),
    ),
  };
}

/** Nota de aderência de uma linha da busca ao ramo (null sem ramo cadastrado). */
export function aderenciaDaLinha(perfil: Perfil | null, l: ResultadoLinha) {
  if (!perfil) return null;
  return calcularAderencia(
    {
      totalTermos: perfil.termos.length,
      termosCasados: l.termosCasados,
      excluidosCasados: l.excluidosCasados,
      ufNoPerfil: perfil.ufs.length ? perfil.ufs.includes(l.uf) : null,
      modalidadeNoPerfil: perfil.modalidades.length ? perfil.modalidades.includes(l.modalidadeId) : null,
    },
    l.uf,
    l.modalidade,
  );
}

/** "Novas" no Para você e na Visão geral: entraram na base nas últimas 24 horas. */
export const inicioDasNovas = () => new Date(Date.now() - 86_400_000);

/** Filtros do recorte "Para você": tudo que está aberto e combina com o ramo. */
export function filtrosDoRamo(perfil: Perfil, extras: Partial<FiltrosBusca> = {}): FiltrosBusca {
  return {
    q: "",
    uf: null,
    modalidade: null,
    valorMinCentavos: null,
    valorMaxCentavos: null,
    encerraEmDias: null,
    pagina: 1,
    perfil,
    apenasRamo: true,
    ...extras,
  };
}

/** Situação da base: quantas abertas e quando foi a última ingestão. */
export async function situacaoDaBase(db: Db) {
  const r = await db.execute<{ abertas: string | number; ultima: string | Date | null }>(sql`
    select (select count(*) from licitacao where data_encerramento > now()) as abertas,
           (select max(ingerido_em) from licitacao) as ultima
  `);
  const linha = r.rows[0];
  return {
    abertas: Number(linha?.abertas ?? 0),
    ultimaIngestao: linha?.ultima ? new Date(linha.ultima) : null,
  };
}

// Modalidades mais frequentes: Pregão Eletrônico, Pregão Presencial, Concorrência, Concorrência Eletrônica
const MODALIDADES_PRINCIPAIS = [6, 5, 1, 12];

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Busca ao vivo na API pública do PNCP — sem banco local.
 * Usado como fallback quando a base ainda está vazia. Resultados são parciais
 * (apenas as primeiras páginas das 4 modalidades mais comuns).
 */
export async function buscarEmTempoReal(parametros: {
  q: string;
  uf?: string | null;
  modalidade?: number | null;
  pagina: number;
}): Promise<{ total: number; parcial: boolean; linhas: ResultadoLinha[] }> {
  const hoje = new Date();
  const dataFinal = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const modalidades = parametros.modalidade ? [parametros.modalidade] : MODALIDADES_PRINCIPAIS;

  const resultados = await Promise.allSettled(
    modalidades.map((mod) =>
      buscarPropostasAbertas({ dataFinal, modalidade: mod, uf: parametros.uf ?? undefined, pagina: 1, tamanhoPagina: 50 }),
    ),
  );

  const todas = resultados
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof buscarPropostasAbertas>>> => r.status === "fulfilled")
    .flatMap((r) => r.value.data);

  const q = normalizar(parametros.q.trim());
  const filtradas = q
    ? todas.filter((c) => normalizar(c.objetoCompra).includes(q) || normalizar(c.orgaoEntidade.razaoSocial).includes(q))
    : todas;

  filtradas.sort((a, b) => {
    const da = new Date(a.dataEncerramentoProposta ?? "9999").getTime();
    const db = new Date(b.dataEncerramentoProposta ?? "9999").getTime();
    return da - db;
  });

  const inicio = (parametros.pagina - 1) * POR_PAGINA;
  return {
    total: filtradas.length,
    parcial: !parametros.modalidade,
    linhas: filtradas.slice(inicio, inicio + POR_PAGINA).map((c): ResultadoLinha => ({
      numeroControle: c.numeroControlePNCP,
      cnpj: c.orgaoEntidade.cnpj,
      ano: c.anoCompra,
      sequencial: c.sequencialCompra,
      objeto: c.objetoCompra.trim(),
      orgao: c.orgaoEntidade.razaoSocial,
      municipio: c.unidadeOrgao.municipioNome ?? null,
      uf: c.unidadeOrgao.ufSigla,
      modalidade: c.modalidadeNome,
      valorCentavos: c.valorTotalEstimado == null ? null : Math.round(c.valorTotalEstimado * 100),
      encerramento: dataBrasilia(c.dataEncerramentoProposta),
      publicacao: dataBrasilia(c.dataPublicacaoPncp),
      etapa: null,
      modalidadeId: c.modalidadeId,
      termosCasados: [],
      excluidosCasados: [],
    })),
  };
}

export async function obterLicitacao(db: Db, organizacaoId: string, cnpj: string, ano: number, sequencial: number) {
  const r = await db.execute<{
    numero_controle_pncp: string;
    objeto: string;
    informacao_complementar: string | null;
    orgao_nome: string;
    unidade_nome: string | null;
    municipio: string | null;
    uf: string;
    modalidade: string;
    modo_disputa_nome: string | null;
    situacao_nome: string;
    srp: boolean;
    valor_estimado_centavos: string | number | null;
    data_abertura: string | Date | null;
    data_encerramento: string | Date | null;
    data_publicacao: string | Date | null;
    processo: string | null;
    numero_compra: string | null;
    link_origem: string | null;
    etapa: string | null;
  }>(sql`
    select l.numero_controle_pncp, l.objeto, l.informacao_complementar, l.orgao_nome, l.unidade_nome,
           l.municipio, l.uf, m.nome as modalidade, l.modo_disputa_nome, l.situacao_nome, l.srp,
           l.valor_estimado_centavos, l.data_abertura, l.data_encerramento, l.data_publicacao,
           l.processo, l.numero_compra, l.link_origem, a.etapa
      from licitacao l
      join modalidade m on m.id = l.modalidade_id
      left join acompanhamento a
        on a.numero_controle_pncp = l.numero_controle_pncp and a.organizacao_id = ${organizacaoId}
     where l.cnpj_orgao = ${cnpj} and l.ano = ${ano} and l.sequencial = ${sequencial}
     limit 1
  `);
  const l = r.rows[0];
  if (!l) return null;
  const data = (v: string | Date | null) => (v == null ? null : new Date(v));
  return {
    numeroControle: l.numero_controle_pncp,
    objeto: l.objeto,
    informacaoComplementar: l.informacao_complementar,
    orgao: l.orgao_nome,
    unidade: l.unidade_nome,
    municipio: l.municipio,
    uf: l.uf,
    modalidade: l.modalidade,
    modoDisputa: l.modo_disputa_nome,
    situacao: l.situacao_nome,
    srp: l.srp,
    valorCentavos: l.valor_estimado_centavos == null ? null : Number(l.valor_estimado_centavos),
    abertura: data(l.data_abertura),
    encerramento: data(l.data_encerramento),
    publicacao: data(l.data_publicacao),
    processo: l.processo,
    numeroCompra: l.numero_compra,
    linkOrigem: l.link_origem,
    etapa: l.etapa,
  };
}
