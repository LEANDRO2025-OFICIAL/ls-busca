-- Gestão de ATAs de registro de preço e contratos administrativos.
-- Aditiva e idempotente (PGlite e Postgres).

create table if not exists contrato (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  tipo text not null default 'contrato' check (tipo in ('contrato', 'ata')),
  numero text not null,
  orgao_nome text not null,
  orgao_cnpj char(14),
  objeto text not null,
  -- Valores em centavos. valor_atual reflete os aditivos; começa igual ao original.
  valor_total_centavos bigint check (valor_total_centavos >= 0),
  valor_atual_centavos bigint check (valor_atual_centavos >= 0),
  data_inicio date not null,
  data_fim date not null,
  -- Número de aditivos feitos.
  aditivos int not null default 0 check (aditivos >= 0),
  -- Referência à licitação de origem (PNCP), se disponível.
  numero_controle_pncp text,
  link_externo text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contrato_org_idx on contrato (organizacao_id, data_fim asc);
create index if not exists contrato_tipo_idx on contrato (organizacao_id, tipo);

drop trigger if exists contrato_updated_at on contrato;
create trigger contrato_updated_at before update on contrato for each row execute function toca_updated_at();
