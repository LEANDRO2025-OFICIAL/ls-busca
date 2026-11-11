-- Login próprio: senha com scrypt e sessão por token aleatório.
-- O token cru só existe no cookie httpOnly; aqui guardamos o sha256 dele,
-- então um vazamento do banco não permite sequestrar sessões.

create table credencial (
  usuario_id uuid primary key references usuario(id) on delete cascade,
  hash_senha text not null,                       -- scrypt$N$r$p$sal$hash
  updated_at timestamptz not null default now()
);

create table sessao (
  id text primary key,                            -- sha256 hex do token
  usuario_id uuid not null references usuario(id) on delete cascade,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessao (usuario_id);
create index on sessao (expira_em);

-- Limite de tentativas de login por e-mail (contra adivinhação de senha).
create table tentativa_login (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);
create index on tentativa_login (email, created_at);
