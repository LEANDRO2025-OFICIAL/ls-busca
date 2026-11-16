-- Melhoria 6: versionamento de edital para detectar retificações.

create table if not exists edital_versao (
  id               bigserial primary key,
  numero_controle  text        not null,
  versao           integer     not null,
  hash_conteudo    text        not null,
  texto            text,
  capturado_em     timestamptz not null default now(),
  unique (numero_controle, versao)
);
