-- Porte da empresa (define se há tratamento diferenciado de ME/EPP) e controle de validade
-- dos documentos de habilitação. Só guarda os dados do documento, não o arquivo.
alter table organizacao add column porte text check (porte in ('mei', 'me', 'epp', 'medio', 'grande'));

create table documento_empresa (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacao(id) on delete cascade,
  tipo text not null check (length(tipo) between 1 and 40),
  nome text not null check (length(nome) between 1 and 200),
  numero text check (length(numero) <= 100),
  validade date,
  -- Onde está o arquivo (pasta, link, gaveta) ou qualquer lembrete.
  observacao text check (length(observacao) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on documento_empresa (organizacao_id, validade);
