// Robô de lance: acesso a dados. Toda leitura e escrita filtra pela organização de quem entrou.
// Modo simulação: nada aqui envia lances a portal algum.
import { sql } from "drizzle-orm";
import type { Db } from "./db";
import type { EntradaItem, EntradaRobo, ItemGravado, Modo } from "@/lib/robo/formulario";
import type { EventoSimulado, ResultadoSimulado } from "@/lib/robo/simulador";
import type { ConfigItem, Criterio, EstadoDisputa, RegistroDecisao } from "@/lib/robo/tipos";

export type LicitacaoDoFunil = {
  acompanhamentoId: string;
  objeto: string;
  orgaoUf: string;
  valorCentavos: number | null;
  etapa: string;
  temRobo: boolean;
};

/** Licitações do funil da organização que ainda estão em jogo (as encerradas ficam de fora). */
export async function licitacoesParaRobo(db: Db, organizacaoId: string): Promise<LicitacaoDoFunil[]> {
  const r = await db.execute<{ id: string; objeto: string; orgao_nome: string; uf: string; valor: string | number | null; etapa: string; tem_robo: boolean }>(sql`
    select a.id, l.objeto, l.orgao_nome, l.uf, l.valor_estimado_centavos as valor, a.etapa,
           exists (select 1 from robo_config c where c.acompanhamento_id = a.id and c.organizacao_id = a.organizacao_id) as tem_robo
      from acompanhamento a
      join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
     where a.organizacao_id = ${organizacaoId}
       and a.etapa not in ('ganhou', 'perdeu', 'desistiu')
     order by a.updated_at desc
     limit 300
  `);
  return r.rows.map((l) => ({
    acompanhamentoId: l.id,
    objeto: l.objeto,
    orgaoUf: `${l.orgao_nome} · ${l.uf}`,
    valorCentavos: l.valor == null ? null : Number(l.valor),
    etapa: l.etapa,
    temRobo: l.tem_robo,
  }));
}

export type ResumoConfig = {
  id: string;
  acompanhamentoId: string;
  objeto: string;
  orgaoUf: string;
  criterio: Criterio;
  modo: Modo;
  itens: number;
  itensParados: number;
  atualizadoEm: Date;
  ultimaSimulacao: { id: string; quando: Date; minhaPosicao: number } | null;
};

export async function listarConfiguracoes(db: Db, organizacaoId: string): Promise<ResumoConfig[]> {
  const r = await db.execute<{
    id: string;
    acompanhamento_id: string;
    objeto: string;
    orgao_nome: string;
    uf: string;
    criterio: Criterio;
    modo: Modo;
    itens: number;
    parados: number;
    updated_at: string | Date;
    sim_id: string | null;
    sim_quando: string | Date | null;
    sim_posicao: number | null;
  }>(sql`
    select c.id, c.acompanhamento_id, l.objeto, l.orgao_nome, l.uf, c.criterio, c.modo, c.updated_at,
           (select count(*)::int from robo_item i where i.robo_config_id = c.id) as itens,
           (select count(*)::int from robo_item i where i.robo_config_id = c.id and i.parada) as parados,
           s.id as sim_id, s.created_at as sim_quando, (s.resultado->>'minhaPosicao')::int as sim_posicao
      from robo_config c
      join acompanhamento a on a.id = c.acompanhamento_id and a.organizacao_id = c.organizacao_id
      join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
      left join lateral (
        select s.id, s.created_at, s.resultado from robo_simulacao s
         where s.robo_config_id = c.id and s.organizacao_id = c.organizacao_id
         order by s.created_at desc limit 1
      ) s on true
     where c.organizacao_id = ${organizacaoId}
     order by c.updated_at desc
  `);
  return r.rows.map((c) => ({
    id: c.id,
    acompanhamentoId: c.acompanhamento_id,
    objeto: c.objeto,
    orgaoUf: `${c.orgao_nome} · ${c.uf}`,
    criterio: c.criterio,
    modo: c.modo,
    itens: c.itens,
    itensParados: c.parados,
    atualizadoEm: new Date(c.updated_at),
    ultimaSimulacao: c.sim_id && c.sim_quando ? { id: c.sim_id, quando: new Date(c.sim_quando), minhaPosicao: c.sim_posicao ?? 0 } : null,
  }));
}

export type ConfigCompleta = {
  acompanhamentoId: string;
  objeto: string;
  orgaoUf: string;
  href: string;
  valorEstimadoCentavos: number | null;
  config: (Omit<EntradaRobo, "itens"> & { id: string; versao: number; itens: ItemGravado[] }) | null;
};

type LinhaItem = {
  id: string;
  numero_item: number;
  descricao: string;
  valor_referencia: string | number;
  limite: string | number;
  estrategia: EntradaItem["estrategia"];
  decremento_tipo: EntradaItem["decrementoTipo"];
  decremento_valor: string | number;
  posicao_alvo: number | null;
  ultimos_segundos: number | null;
  lance_final: string | number | null;
  desconto_maximo_por_lance: number | null;
  max_lances_por_minuto: number;
  max_erros_seguidos: number;
  me_epp: boolean;
  parada: boolean;
};

const numeroOuNull = (v: string | number | null) => (v == null ? null : Number(v));

function itemDaLinha(i: LinhaItem): ItemGravado {
  return {
    id: i.id,
    numeroItem: i.numero_item,
    descricao: i.descricao,
    valorReferencia: Number(i.valor_referencia),
    limite: Number(i.limite),
    estrategia: i.estrategia,
    decrementoTipo: i.decremento_tipo,
    decrementoValor: Number(i.decremento_valor),
    posicaoAlvo: i.posicao_alvo,
    ultimosSegundos: i.ultimos_segundos,
    lanceFinal: numeroOuNull(i.lance_final),
    descontoMaximoPorLance: i.desconto_maximo_por_lance,
    maxLancesPorMinuto: i.max_lances_por_minuto,
    maxErrosSeguidos: i.max_erros_seguidos,
    meEpp: i.me_epp,
    parada: i.parada,
  };
}

/** Licitação do funil (da organização) e a configuração do robô, se houver. null se o cartão não é da organização. */
export async function obterConfiguracao(db: Db, organizacaoId: string, acompanhamentoId: string): Promise<ConfigCompleta | null> {
  const r = await db.execute<{
    objeto: string;
    orgao_nome: string;
    uf: string;
    cnpj_orgao: string;
    ano: number;
    sequencial: number;
    valor: string | number | null;
    config_id: string | null;
    criterio: Criterio | null;
    modo: Modo | null;
    intervalo_proprio_ms: number | null;
    intervalo_melhor_ms: number | null;
    diferenca_propria: string | number | null;
    diferenca_melhor: string | number | null;
    versao: number | null;
  }>(sql`
    select l.objeto, l.orgao_nome, l.uf, l.cnpj_orgao, l.ano, l.sequencial, l.valor_estimado_centavos as valor,
           c.id as config_id, c.criterio, c.modo, c.intervalo_proprio_ms, c.intervalo_melhor_ms,
           c.diferenca_propria, c.diferenca_melhor, c.versao
      from acompanhamento a
      join licitacao l on l.numero_controle_pncp = a.numero_controle_pncp
      left join robo_config c on c.acompanhamento_id = a.id and c.organizacao_id = a.organizacao_id
     where a.id = ${acompanhamentoId} and a.organizacao_id = ${organizacaoId}
  `);
  const l = r.rows[0];
  if (!l) return null;
  let config: ConfigCompleta["config"] = null;
  if (l.config_id) {
    const itens = await db.execute<LinhaItem>(sql`
      select * from robo_item where robo_config_id = ${l.config_id} and organizacao_id = ${organizacaoId} order by numero_item
    `);
    config = {
      id: l.config_id,
      versao: l.versao ?? 1,
      criterio: l.criterio ?? "menor_preco",
      modo: l.modo ?? "aberto",
      parametros: {
        intervaloProprioMs: l.intervalo_proprio_ms ?? 0,
        intervaloMelhorMs: l.intervalo_melhor_ms ?? 0,
        diferencaPropria: Number(l.diferenca_propria ?? 1),
        diferencaMelhor: Number(l.diferenca_melhor ?? 1),
      },
      itens: itens.rows.map(itemDaLinha),
    };
  }
  return {
    acompanhamentoId,
    objeto: l.objeto,
    orgaoUf: `${l.orgao_nome} · ${l.uf}`,
    href: `/licitacao/${l.cnpj_orgao}/${l.ano}/${l.sequencial}`,
    valorEstimadoCentavos: numeroOuNull(l.valor),
    config,
  };
}

export type ResultadoSalvar = { ok: true; configId: string } | { ok: false; motivo: "nao_encontrado" | "conflito" };

/**
 * Cria ou atualiza a configuração e os itens (pelo número do item). Itens que saíram do formulário
 * são apagados; a parada de emergência de cada item que continua é preservada.
 * `versaoEsperada`: trava otimista (null = criando).
 */
export async function salvarConfiguracao(
  db: Db,
  organizacaoId: string,
  usuarioId: string,
  acompanhamentoId: string,
  entrada: EntradaRobo,
  versaoEsperada: number | null,
): Promise<ResultadoSalvar> {
  return db.transaction(async (tx) => {
    const dono = await tx.execute<{ id: string }>(sql`
      select id from acompanhamento where id = ${acompanhamentoId} and organizacao_id = ${organizacaoId}
    `);
    if (!dono.rows[0]) return { ok: false, motivo: "nao_encontrado" } as const;
    const p = entrada.parametros;
    let configId: string | undefined;
    if (versaoEsperada == null) {
      const novo = await tx.execute<{ id: string }>(sql`
        insert into robo_config (organizacao_id, acompanhamento_id, criterio, modo, intervalo_proprio_ms, intervalo_melhor_ms,
                                 diferenca_propria, diferenca_melhor, criado_por)
        values (${organizacaoId}, ${acompanhamentoId}, ${entrada.criterio}, ${entrada.modo}, ${p.intervaloProprioMs},
                ${p.intervaloMelhorMs}, ${p.diferencaPropria}, ${p.diferencaMelhor}, ${usuarioId})
        on conflict (organizacao_id, acompanhamento_id) do nothing
        returning id
      `);
      configId = novo.rows[0]?.id;
    } else {
      const atual = await tx.execute<{ id: string }>(sql`
        update robo_config
           set criterio = ${entrada.criterio}, modo = ${entrada.modo}, intervalo_proprio_ms = ${p.intervaloProprioMs},
               intervalo_melhor_ms = ${p.intervaloMelhorMs}, diferenca_propria = ${p.diferencaPropria},
               diferenca_melhor = ${p.diferencaMelhor}, versao = versao + 1
         where acompanhamento_id = ${acompanhamentoId} and organizacao_id = ${organizacaoId} and versao = ${versaoEsperada}
        returning id
      `);
      configId = atual.rows[0]?.id;
    }
    if (!configId) return { ok: false, motivo: "conflito" } as const;

    const numeros = entrada.itens.map((i) => i.numeroItem);
    await tx.execute(sql`
      delete from robo_item
       where robo_config_id = ${configId} and organizacao_id = ${organizacaoId}
         and not (numero_item = any(${sql.raw(`array[${numeros.map((n) => Math.trunc(n)).join(",") || "0"}]::int[]`)}))
    `);
    for (const i of entrada.itens) {
      await tx.execute(sql`
        insert into robo_item (organizacao_id, robo_config_id, numero_item, descricao, valor_referencia, limite, estrategia,
                               decremento_tipo, decremento_valor, posicao_alvo, ultimos_segundos, lance_final,
                               desconto_maximo_por_lance, max_lances_por_minuto, max_erros_seguidos, me_epp)
        values (${organizacaoId}, ${configId}, ${i.numeroItem}, ${i.descricao}, ${i.valorReferencia}, ${i.limite}, ${i.estrategia},
                ${i.decrementoTipo}, ${i.decrementoValor}, ${i.posicaoAlvo}, ${i.ultimosSegundos}, ${i.lanceFinal},
                ${i.descontoMaximoPorLance}, ${i.maxLancesPorMinuto}, ${i.maxErrosSeguidos}, ${i.meEpp})
        on conflict (robo_config_id, numero_item) do update set
          descricao = excluded.descricao, valor_referencia = excluded.valor_referencia, limite = excluded.limite,
          estrategia = excluded.estrategia, decremento_tipo = excluded.decremento_tipo,
          decremento_valor = excluded.decremento_valor, posicao_alvo = excluded.posicao_alvo,
          ultimos_segundos = excluded.ultimos_segundos, lance_final = excluded.lance_final,
          desconto_maximo_por_lance = excluded.desconto_maximo_por_lance,
          max_lances_por_minuto = excluded.max_lances_por_minuto, max_erros_seguidos = excluded.max_erros_seguidos,
          me_epp = excluded.me_epp
      `);
    }
    return { ok: true, configId } as const;
  });
}

export async function removerConfiguracao(db: Db, organizacaoId: string, configId: string) {
  await db.execute(sql`delete from robo_config where id = ${configId} and organizacao_id = ${organizacaoId}`);
}

/** Parada de emergência de um item. Devolve false se o item não é da organização. */
export async function definirParadaDoItem(db: Db, organizacaoId: string, itemId: string, parada: boolean): Promise<boolean> {
  const r = await db.execute<{ id: string }>(sql`
    update robo_item set parada = ${parada} where id = ${itemId} and organizacao_id = ${organizacaoId} returning id
  `);
  return r.rows.length > 0;
}

export type ParadaGeral = { ativa: boolean; alteradaEm: Date | null; alteradaPor: string | null };

export async function lerParadaGeral(db: Db, organizacaoId: string): Promise<ParadaGeral> {
  const r = await db.execute<{ ativa: boolean; alterada_em: string | Date; nome: string | null }>(sql`
    select p.ativa, p.alterada_em, u.nome
      from robo_parada p left join usuario u on u.id = p.alterada_por
     where p.organizacao_id = ${organizacaoId}
  `);
  const p = r.rows[0];
  return p ? { ativa: p.ativa, alteradaEm: new Date(p.alterada_em), alteradaPor: p.nome } : { ativa: false, alteradaEm: null, alteradaPor: null };
}

/** Liga ou desliga a parada de emergência geral. Ao ligar, também marca a parada de todos os itens. */
export async function definirParadaGeral(db: Db, organizacaoId: string, usuarioId: string, ativa: boolean) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into robo_parada (organizacao_id, ativa, alterada_por, alterada_em)
      values (${organizacaoId}, ${ativa}, ${usuarioId}, now())
      on conflict (organizacao_id) do update set ativa = excluded.ativa, alterada_por = excluded.alterada_por, alterada_em = now()
    `);
    if (ativa) await tx.execute(sql`update robo_item set parada = true where organizacao_id = ${organizacaoId} and not parada`);
  });
}

export type ItemParaSimular = { item: ItemGravado; configId: string; criterio: Criterio; modo: Modo; parametros: EntradaRobo["parametros"] };

export async function obterItemParaSimular(db: Db, organizacaoId: string, itemId: string): Promise<ItemParaSimular | null> {
  const r = await db.execute<LinhaItem & {
    config_id: string;
    criterio: Criterio;
    modo: Modo;
    intervalo_proprio_ms: number;
    intervalo_melhor_ms: number;
    diferenca_propria: string | number;
    diferenca_melhor: string | number;
  }>(sql`
    select i.*, c.id as config_id, c.criterio, c.modo, c.intervalo_proprio_ms, c.intervalo_melhor_ms, c.diferenca_propria, c.diferenca_melhor
      from robo_item i join robo_config c on c.id = i.robo_config_id and c.organizacao_id = i.organizacao_id
     where i.id = ${itemId} and i.organizacao_id = ${organizacaoId}
  `);
  const l = r.rows[0];
  if (!l) return null;
  return {
    item: itemDaLinha(l),
    configId: l.config_id,
    criterio: l.criterio,
    modo: l.modo,
    parametros: {
      intervaloProprioMs: l.intervalo_proprio_ms,
      intervaloMelhorMs: l.intervalo_melhor_ms,
      diferencaPropria: Number(l.diferenca_propria),
      diferencaMelhor: Number(l.diferenca_melhor),
    },
  };
}

export type DecisaoGravada = RegistroDecisao & { repeticoes: number; ateMs: number };

export type NovaSimulacao = {
  configId: string;
  itemId: string;
  descricaoItem: string;
  config: ConfigItem;
  cenario: unknown;
  resultado: ResultadoSimulado;
  linhaDoTempo: EventoSimulado[];
  parouPor: string;
  decisoes: DecisaoGravada[];
};

/** Grava a sessão de simulação e a trilha de decisões, juntas (tudo ou nada). */
export async function registrarSimulacao(db: Db, organizacaoId: string, usuarioId: string, s: NovaSimulacao): Promise<string | null> {
  return db.transaction(async (tx) => {
    const dono = await tx.execute<{ id: string }>(sql`
      select i.id from robo_item i where i.id = ${s.itemId} and i.robo_config_id = ${s.configId} and i.organizacao_id = ${organizacaoId}
    `);
    if (!dono.rows[0]) return null;
    const nova = await tx.execute<{ id: string }>(sql`
      insert into robo_simulacao (organizacao_id, robo_config_id, robo_item_id, descricao_item, config, cenario, resultado,
                                  linha_do_tempo, parou_por, criado_por)
      values (${organizacaoId}, ${s.configId}, ${s.itemId}, ${s.descricaoItem}, ${JSON.stringify(s.config)}::jsonb,
              ${JSON.stringify(s.cenario)}::jsonb, ${JSON.stringify(s.resultado)}::jsonb,
              ${JSON.stringify(s.linhaDoTempo)}::jsonb, ${s.parouPor}, ${usuarioId})
      returning id
    `);
    const id = nova.rows[0].id;
    // Em remessas: uma inserção por linha seria lenta no banco embutido.
    for (let inicio = 0; inicio < s.decisoes.length; inicio += 200) {
      const lote = s.decisoes.slice(inicio, inicio + 200).map((d, j) => ({
        ordem: inicio + j + 1,
        instante_ms: d.instanteMs,
        ate_ms: d.ateMs,
        repeticoes: d.repeticoes,
        acao: d.acao,
        regra: d.regra,
        valor: d.valor,
        motivo: d.motivo,
        empate_ficto: d.empateFicto,
        envio: d.envio,
        estado: d.estado,
      }));
      await tx.execute(sql`
        insert into robo_decisao (organizacao_id, simulacao_id, ordem, instante_ms, ate_ms, repeticoes, acao, regra, valor,
                                  motivo, empate_ficto, envio, estado)
        select ${organizacaoId}, ${id}, x.ordem, x.instante_ms, x.ate_ms, x.repeticoes, x.acao, x.regra, x.valor,
               x.motivo, x.empate_ficto, x.envio, x.estado
          from jsonb_to_recordset(${JSON.stringify(lote)}::jsonb) as x(
            ordem int, instante_ms bigint, ate_ms bigint, repeticoes int, acao text, regra text, valor bigint,
            motivo text, empate_ficto text, envio text, estado jsonb)
      `);
    }
    return id;
  });
}

export type ResumoSimulacao = { id: string; quando: Date; descricaoItem: string; resultado: ResultadoSimulado; parouPor: string };

export async function listarSimulacoes(db: Db, organizacaoId: string, configId: string, limite = 20): Promise<ResumoSimulacao[]> {
  const r = await db.execute<{ id: string; created_at: string | Date; descricao_item: string; resultado: ResultadoSimulado; parou_por: string }>(sql`
    select id, created_at, descricao_item, resultado, parou_por from robo_simulacao
     where robo_config_id = ${configId} and organizacao_id = ${organizacaoId}
     order by created_at desc limit ${limite}
  `);
  return r.rows.map((s) => ({ id: s.id, quando: new Date(s.created_at), descricaoItem: s.descricao_item, resultado: s.resultado, parouPor: s.parou_por }));
}

export type SimulacaoCompleta = ResumoSimulacao & {
  acompanhamentoId: string | null;
  config: ConfigItem;
  cenario: { semente: number; modo: Modo; concorrentes: { nome: string; perfil: string; lanceInicial: number; pisoProprio: number }[]; duracaoAbertaMs: number };
  linhaDoTempo: EventoSimulado[];
  decisoes: DecisaoGravada[];
};

export async function obterSimulacao(db: Db, organizacaoId: string, id: string): Promise<SimulacaoCompleta | null> {
  const r = await db.execute<{
    id: string;
    created_at: string | Date;
    descricao_item: string;
    resultado: ResultadoSimulado;
    parou_por: string;
    config: ConfigItem;
    cenario: SimulacaoCompleta["cenario"];
    linha_do_tempo: EventoSimulado[];
    acompanhamento_id: string | null;
  }>(sql`
    select s.id, s.created_at, s.descricao_item, s.resultado, s.parou_por, s.config, s.cenario, s.linha_do_tempo, c.acompanhamento_id
      from robo_simulacao s left join robo_config c on c.id = s.robo_config_id and c.organizacao_id = s.organizacao_id
     where s.id = ${id} and s.organizacao_id = ${organizacaoId}
  `);
  const s = r.rows[0];
  if (!s) return null;
  const d = await db.execute<{
    instante_ms: string | number;
    ate_ms: string | number;
    repeticoes: number;
    acao: RegistroDecisao["acao"];
    regra: RegistroDecisao["regra"];
    valor: string | number | null;
    motivo: string;
    empate_ficto: string | null;
    envio: RegistroDecisao["envio"];
    estado: EstadoDisputa | null;
  }>(sql`
    select instante_ms, ate_ms, repeticoes, acao, regra, valor, motivo, empate_ficto, envio, estado
      from robo_decisao where simulacao_id = ${id} and organizacao_id = ${organizacaoId} order by ordem
  `);
  return {
    id: s.id,
    quando: new Date(s.created_at),
    descricaoItem: s.descricao_item,
    resultado: s.resultado,
    parouPor: s.parou_por,
    acompanhamentoId: s.acompanhamento_id,
    config: s.config,
    cenario: s.cenario,
    linhaDoTempo: s.linha_do_tempo,
    decisoes: d.rows.map((x) => ({
      instanteMs: Number(x.instante_ms),
      ateMs: Number(x.ate_ms),
      repeticoes: x.repeticoes,
      acao: x.acao,
      regra: x.regra,
      valor: numeroOuNull(x.valor),
      motivo: x.motivo,
      empateFicto: x.empate_ficto,
      envio: x.envio,
      estado: x.estado,
    })),
  };
}
