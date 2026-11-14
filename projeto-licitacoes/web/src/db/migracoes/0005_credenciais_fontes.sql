-- Fontes externas de licitações. Sem nomes de terceiros neste arquivo.

create table credencial_fonte (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  fonte text not null check (fonte in ('alpha', 'beta')),
  login text not null,
  senha_enc text not null,
  token text,
  token_expira_em timestamptz,
  status text not null default 'pendente'
    check (status in ('pendente', 'ativa', 'erro', 'desativada')),
  ultimo_erro text,
  ultima_sinc timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizacao_id, fonte)
);
create index on credencial_fonte (organizacao_id);
create index on credencial_fonte (token_expira_em) where status = 'ativa';

-- Estende busca_salva com canais de entrega
alter table busca_salva
  add column if not exists canal_email boolean not null default false,
  add column if not exists canal_whatsapp boolean not null default false,
  add column if not exists email_destino text;

-- Cache de licitações das fontes externas
create table licitacao_externa (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  fonte text not null check (fonte in ('alpha', 'beta')),
  id_externo text not null,
  objeto text not null,
  orgao text not null,
  uf char(2),
  valor_centavos bigint,
  data_abertura timestamptz,
  data_encerramento timestamptz,
  status_ext text not null default 'aberta',
  link_externo text,
  cnaes text[] not null default '{}',
  bruto jsonb not null default '{}',
  ingerida_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizacao_id, fonte, id_externo)
);
create index on licitacao_externa (organizacao_id, fonte);
create index on licitacao_externa (organizacao_id, data_encerramento);

-- Resumo periódico das fontes (dashboard)
create table resumo_fonte (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  fonte text not null check (fonte in ('alpha', 'beta')),
  total_abertas int,
  total_favoritas int,
  boletins_nao_lidos int,
  notificacoes_nao_lidas int,
  capturado_em timestamptz not null default now(),
  unique (organizacao_id, fonte)
);

create trigger credencial_fonte_updated_at
  before update on credencial_fonte
  for each row execute function toca_updated_at();

create trigger licitacao_externa_updated_at
  before update on licitacao_externa
  for each row execute function toca_updated_at();
