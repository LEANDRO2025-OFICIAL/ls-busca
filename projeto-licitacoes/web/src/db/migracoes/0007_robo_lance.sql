-- Robô de lance (modo simulação): configurações por licitação do funil e por item,
-- parada de emergência geral, sessões de simulação e trilha de decisões (só acréscimo).
-- Aditiva e idempotente (PGlite e Postgres). Valores sempre inteiros: centavos (menor preço)
-- ou centésimos de ponto percentual (maior desconto).

create table if not exists robo_config (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  acompanhamento_id uuid not null references acompanhamento(id) on delete cascade,
  criterio text not null default 'menor_preco' check (criterio in ('menor_preco', 'maior_desconto')),
  modo text not null default 'aberto' check (modo in ('aberto', 'aberto_fechado')),
  -- Regras de tempo e valor da disputa: configuráveis por disputa (cada edital define as suas).
  intervalo_proprio_ms int not null default 20000 check (intervalo_proprio_ms between 0 and 86400000),
  intervalo_melhor_ms int not null default 3000 check (intervalo_melhor_ms between 0 and 86400000),
  diferenca_propria bigint not null default 1 check (diferenca_propria >= 0),
  diferenca_melhor bigint not null default 1 check (diferenca_melhor >= 0),
  versao int not null default 1,
  criado_por uuid references usuario(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizacao_id, acompanhamento_id)
);
create index if not exists robo_config_org_idx on robo_config (organizacao_id, updated_at desc);

create table if not exists robo_item (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  robo_config_id uuid not null references robo_config(id) on delete cascade,
  numero_item int not null check (numero_item between 1 and 9999),
  descricao text not null,
  -- Valor de partida usado pelo simulador (proposta inicial).
  valor_referencia bigint not null check (valor_referencia >= 0),
  -- Piso (menor preço) ou desconto máximo (maior desconto). Obrigatório: sem ele o robô não inicia.
  limite bigint not null check (limite >= 0),
  estrategia text not null check (estrategia in ('cobrir', 'primeiro', 'posicao_alvo', 'ultimos_segundos', 'lance_final')),
  decremento_tipo text not null check (decremento_tipo in ('fixo', 'percentual')),
  decremento_valor bigint not null check (decremento_valor >= 1),
  posicao_alvo int check (posicao_alvo between 1 and 50),
  ultimos_segundos int check (ultimos_segundos between 1 and 3600),
  lance_final bigint check (lance_final >= 0),
  desconto_maximo_por_lance int check (desconto_maximo_por_lance between 1 and 10000),
  max_lances_por_minuto int not null default 6 check (max_lances_por_minuto between 1 and 60),
  max_erros_seguidos int not null default 3 check (max_erros_seguidos between 1 and 20),
  me_epp boolean not null default false,
  -- Parada de emergência deste item.
  parada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (robo_config_id, numero_item)
);
create index if not exists robo_item_config_idx on robo_item (robo_config_id, numero_item);

-- Parada de emergência geral: uma linha por organização.
create table if not exists robo_parada (
  organizacao_id uuid primary key references organizacao(id) on delete cascade,
  ativa boolean not null default false,
  alterada_por uuid references usuario(id) on delete set null,
  alterada_em timestamptz not null default now()
);

create table if not exists robo_simulacao (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  robo_config_id uuid references robo_config(id) on delete set null,
  robo_item_id uuid references robo_item(id) on delete set null,
  -- Cópias do que foi usado, para a simulação continuar legível se a configuração mudar.
  descricao_item text not null,
  config jsonb not null,
  cenario jsonb not null,
  resultado jsonb not null,
  linha_do_tempo jsonb not null,
  parou_por text not null,
  criado_por uuid references usuario(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists robo_simulacao_org_idx on robo_simulacao (organizacao_id, created_at desc);
create index if not exists robo_simulacao_config_idx on robo_simulacao (robo_config_id, created_at desc);

create table if not exists robo_decisao (
  id bigserial primary key,
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  simulacao_id uuid not null references robo_simulacao(id) on delete cascade,
  ordem int not null,
  instante_ms bigint not null,
  -- Esperas seguidas pela mesma regra viram uma linha só (até ate_ms, com repeticoes).
  ate_ms bigint not null,
  repeticoes int not null default 1,
  acao text not null check (acao in ('lancar', 'aguardar', 'parar')),
  regra text not null,
  valor bigint,
  motivo text not null,
  empate_ficto text,
  envio text check (envio in ('aceito', 'recusado', 'erro')),
  estado jsonb,
  created_at timestamptz not null default now(),
  unique (simulacao_id, ordem)
);
create index if not exists robo_decisao_org_idx on robo_decisao (organizacao_id, simulacao_id);

-- Trilha só aceita acréscimo: nada de alterar, nem apagar enquanto a simulação existir
-- (a remoção em cascata, quando a simulação ou a organização some, continua permitida).
create or replace function robo_decisao_so_acrescimo() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'A trilha de decisões do robô não pode ser alterada.';
  end if;
  if exists (select 1 from robo_simulacao s where s.id = old.simulacao_id) then
    raise exception 'A trilha de decisões do robô não pode ser apagada.';
  end if;
  return old;
end $$;
drop trigger if exists robo_decisao_so_acrescimo on robo_decisao;
create trigger robo_decisao_so_acrescimo before update or delete on robo_decisao
  for each row execute function robo_decisao_so_acrescimo();

drop trigger if exists robo_config_updated_at on robo_config;
create trigger robo_config_updated_at before update on robo_config for each row execute function toca_updated_at();
drop trigger if exists robo_item_updated_at on robo_item;
create trigger robo_item_updated_at before update on robo_item for each row execute function toca_updated_at();
