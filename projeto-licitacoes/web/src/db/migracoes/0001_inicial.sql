-- Schema inicial: busca de licitações + funil de acompanhamento.
-- Postgres 15+. Extensões: unaccent, pg_trgm (ambas disponíveis no Supabase e no Neon).
-- Acesso: verificação de autorização na camada de dados (todo acesso ao banco
-- passa pelo servidor; o navegador nunca fala com o Postgres). Ver architecture.md.
-- Datas sempre em timestamptz (UTC). Dinheiro em centavos (bigint).

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Busca em português: "licitação" casa com "licitacoes", "LICITAÇÕES" etc.
-- ---------------------------------------------------------------------------
create text search configuration pt (copy = portuguese);
alter text search configuration pt
  alter mapping for hword, hword_part, word with unaccent, portuguese_stem;

-- unaccent() não é immutable; este invólucro é, para poder ser usado em índices.
create function f_unaccent(text) returns text
  language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- ---------------------------------------------------------------------------
-- Contas
-- ---------------------------------------------------------------------------
create table organizacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(nome) between 1 and 200),
  cnpj text unique check (cnpj ~ '^[0-9]{14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- id = id do usuário no provedor de autenticação (Supabase Auth).
create table usuario (
  id uuid primary key,
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel text not null default 'membro' check (papel in ('dono', 'admin', 'membro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on usuario (organizacao_id);

-- O que a empresa vende e onde atua. Base do recorte "meu ramo" e da aderência.
create table perfil_ramo (
  organizacao_id uuid primary key references organizacao(id) on delete cascade,
  termos text[] not null default '{}',
  termos_excluidos text[] not null default '{}',
  ufs char(2)[] not null default '{}',
  modalidades int[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Dados públicos do PNCP (compartilhados entre todas as organizações)
-- ---------------------------------------------------------------------------
-- Preenchida a partir de modalidadeId/modalidadeNome que a própria API devolve,
-- para não depender de uma tabela de códigos digitada à mão.
create table modalidade (
  id int primary key,
  nome text not null
);

create table licitacao (
  numero_controle_pncp text primary key,          -- ex.: 03155926000144-1-000089/2026
  cnpj_orgao char(14) not null,
  ano int not null,
  sequencial int not null,
  numero_compra text,
  processo text,
  objeto text not null,
  informacao_complementar text,
  modalidade_id int not null references modalidade(id),
  modo_disputa_id int,
  modo_disputa_nome text,
  situacao_id smallint not null,
  situacao_nome text not null,
  srp boolean not null default false,
  valor_estimado_centavos bigint check (valor_estimado_centavos >= 0),
  moeda char(3) not null default 'BRL',
  data_abertura timestamptz,
  data_encerramento timestamptz,
  data_publicacao timestamptz,
  data_atualizacao_pncp timestamptz,              -- dataAtualizacaoGlobal da API
  uf char(2) not null,
  municipio text,
  codigo_ibge text,
  orgao_nome text not null,
  unidade_nome text,
  link_origem text,
  bruto jsonb not null,                           -- resposta original, para reprocessar sem nova chamada
  ingerido_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cnpj_orgao, ano, sequencial),
  -- Busca: objeto pesa mais que órgão, que pesa mais que o complemento.
  busca tsvector generated always as (
    setweight(to_tsvector('pt', coalesce(objeto, '')), 'A') ||
    setweight(to_tsvector('pt', coalesce(orgao_nome, '') || ' ' || coalesce(unidade_nome, '')), 'B') ||
    setweight(to_tsvector('pt', coalesce(informacao_complementar, '')), 'C')
  ) stored
);
create index licitacao_busca_idx on licitacao using gin (busca);
-- "Encerrando em 7 dias", "abertas agora" e ordenação padrão.
create index on licitacao (data_encerramento);
create index on licitacao (uf, modalidade_id, data_encerramento);
create index on licitacao (valor_estimado_centavos);
create index on licitacao (data_atualizacao_pncp);
-- Busca parcial por número do processo e nome do órgão ("prefeitura de dour").
create index on licitacao using gin (f_unaccent(lower(processo)) gin_trgm_ops);
create index on licitacao using gin (f_unaccent(lower(orgao_nome)) gin_trgm_ops);

create table item_licitacao (
  numero_controle_pncp text not null references licitacao(numero_controle_pncp) on delete cascade,
  numero_item int not null,
  descricao text not null,
  quantidade numeric(18, 4),
  unidade text,
  valor_unitario_centavos bigint check (valor_unitario_centavos >= 0),
  primary key (numero_controle_pncp, numero_item),
  busca tsvector generated always as (to_tsvector('pt', descricao)) stored
);
create index on item_licitacao using gin (busca);

-- Controle da ingestão: uma linha por fatia (endpoint + modalidade + UF).
-- O job retoma da última página em vez de recomeçar.
create table ingestao_fatia (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null check (endpoint in ('proposta', 'atualizacao')),
  modalidade_id int not null,
  uf char(2),                                     -- null = Brasil inteiro
  janela_inicio date,                             -- só para 'atualizacao'
  janela_fim date not null,
  proxima_pagina int not null default 1 check (proxima_pagina >= 1),
  total_paginas int,
  status text not null default 'pendente'
    check (status in ('pendente', 'rodando', 'concluida', 'erro')),
  tentativas int not null default 0,
  ultimo_erro text,
  bloqueada_ate timestamptz,                      -- evita dois workers na mesma fatia
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (endpoint, modalidade_id, uf, janela_inicio, janela_fim)
);
create index on ingestao_fatia (status, bloqueada_ate);

-- ---------------------------------------------------------------------------
-- Buscas salvas e avisos
-- ---------------------------------------------------------------------------
create table busca_salva (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  usuario_id uuid not null references usuario(id) on delete cascade,
  nome text not null check (length(nome) between 1 and 120),
  texto text not null default '',                 -- sintaxe web: cimento -asfalto "material de construção"
  filtros jsonb not null default '{}',            -- ufs, modalidades, valor_min/max, encerra_em_dias
  alerta_ativo boolean not null default false,
  frequencia text not null default 'diaria' check (frequencia in ('imediata', 'diaria')),
  ultimo_alerta_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on busca_salva (organizacao_id);
create index on busca_salva (usuario_id);
create index on busca_salva (alerta_ativo) where alerta_ativo;

create table aviso (
  id uuid primary key default gen_random_uuid(),
  busca_salva_id uuid not null references busca_salva(id) on delete cascade,
  numero_controle_pncp text not null references licitacao(numero_controle_pncp) on delete cascade,
  motivo text not null,                           -- ex.: 'objeto contém "cimento"; UF MS'
  canal text not null default 'email' check (canal in ('email', 'push')),
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  -- Deduplicação: a mesma licitação nunca é avisada duas vezes pela mesma busca.
  unique (busca_salva_id, numero_controle_pncp)
);
create index on aviso (numero_controle_pncp);
create index on aviso (enviado_em) where enviado_em is null;

-- ---------------------------------------------------------------------------
-- Funil
-- ---------------------------------------------------------------------------
create table acompanhamento (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  -- restrict: um card no funil impede apagar a licitação da base por limpeza.
  numero_controle_pncp text not null references licitacao(numero_controle_pncp) on delete restrict,
  etapa text not null default 'interesse' check (etapa in (
    'interesse', 'analise', 'decidido_participar', 'proposta_enviada',
    'sessao_hoje', 'em_disputa', 'ganhou', 'perdeu', 'desistiu'
  )),
  prioridade smallint not null default 2 check (prioridade between 1 and 3),  -- 1 alta, 3 baixa
  tags text[] not null default '{}',
  responsavel_id uuid references usuario(id) on delete set null,
  prazo_etapa timestamptz,
  posicao int not null default 0,                 -- ordem dentro da coluna
  versao int not null default 1,                  -- trava otimista: dois usuários movendo o mesmo card
  criado_por uuid references usuario(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A mesma licitação entra uma única vez no funil de cada organização.
  unique (organizacao_id, numero_controle_pncp)
);
create index on acompanhamento (organizacao_id, etapa, posicao);
create index on acompanhamento (numero_controle_pncp);
create index on acompanhamento (responsavel_id);
create index on acompanhamento (organizacao_id, prazo_etapa);
create index on acompanhamento using gin (tags);

create table mudanca_etapa (
  id uuid primary key default gen_random_uuid(),
  acompanhamento_id uuid not null references acompanhamento(id) on delete cascade,
  de text,
  para text not null,
  usuario_id uuid references usuario(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on mudanca_etapa (acompanhamento_id, created_at);

create table checklist_item (
  id uuid primary key default gen_random_uuid(),
  acompanhamento_id uuid not null references acompanhamento(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 300),
  feito boolean not null default false,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on checklist_item (acompanhamento_id, ordem);

create table nota (
  id uuid primary key default gen_random_uuid(),
  acompanhamento_id uuid not null references acompanhamento(id) on delete cascade,
  autor_id uuid references usuario(id) on delete set null,
  texto text not null check (length(texto) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on nota (acompanhamento_id, created_at);

-- Prazos manuais (além de abertura/encerramento que vêm do PNCP).
create table prazo (
  id uuid primary key default gen_random_uuid(),
  acompanhamento_id uuid not null references acompanhamento(id) on delete cascade,
  titulo text not null,
  quando timestamptz not null,
  created_at timestamptz not null default now()
);
create index on prazo (acompanhamento_id);
create index on prazo (quando);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create function toca_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizacao', 'usuario', 'perfil_ramo', 'licitacao', 'ingestao_fatia',
    'busca_salva', 'acompanhamento', 'checklist_item', 'nota'
  ] loop
    execute format(
      'create trigger %I before update on %I for each row execute function toca_updated_at()',
      t || '_updated_at', t);
  end loop;
end $$;
