-- Melhoria 5: cursor de ingestão por modalidade/UF.
-- Persiste a última página concluída para retomar após restart/timeout.

create table if not exists ingestao_cursor (
  modalidade    text    not null,
  uf            text    not null default '',
  ultima_pagina integer not null default 0,
  total_paginas integer,
  atualizado_em timestamptz not null default now(),
  primary key (modalidade, uf)
);
