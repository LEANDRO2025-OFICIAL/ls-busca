-- Chaves em uuid, como organizacao/usuario/robo_config/robo_item (0001, 0007): FK text -> uuid
-- não existe no Postgres. Corrigido no próprio arquivo porque esta migração nunca chegou a
-- ser registrada em banco algum (aplicarMigracoes roda cada arquivo em transação).

-- Credenciais cifradas para portais de licitação (AES-256-GCM via ROBO_KEY).
create table if not exists robo_credencial (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  portal         text not null check (portal in ('comprasnet', 'bnc', 'licitanet')),
  apelido        text not null,
  login          text not null,
  senha_enc      text not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  constraint robo_credencial_uniq unique (organizacao_id, portal, login)
);

-- Sessão de execução do robô real (uma por item por pregão).
create table if not exists robo_sessao (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  robo_config_id uuid not null references robo_config(id) on delete restrict,
  robo_item_id   uuid not null references robo_item(id) on delete restrict,
  credencial_id  uuid references robo_credencial(id) on delete set null,
  portal         text not null,
  url_disputa    text not null,
  numero_item    int not null default 1,
  estado         text not null default 'aguardando'
                   check (estado in ('aguardando', 'conectando', 'em_disputa', 'encerrado', 'erro', 'parado')),
  iniciada_por   uuid references usuario(id) on delete set null,
  iniciada_em    timestamptz not null default now(),
  encerrada_em   timestamptz,
  mensagem_final text
);

-- Log em tempo real de cada sessão.
create table if not exists robo_log (
  id             bigserial primary key,
  sessao_id      uuid not null references robo_sessao(id) on delete cascade,
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  instante       timestamptz not null default now(),
  nivel          text not null default 'info' check (nivel in ('info', 'lance', 'aviso', 'erro')),
  texto          text not null,
  detalhe        jsonb
);
create index if not exists robo_log_sessao on robo_log (sessao_id, id);
