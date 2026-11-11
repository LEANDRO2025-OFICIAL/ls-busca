-- Alertas na própria tela: "novas" = licitações que entraram na base depois da última visita.
-- ingerido_em muda a cada atualização do PNCP; primeira_vez_em nunca muda depois do insert.
alter table licitacao add column primeira_vez_em timestamptz not null default now();
create index on licitacao (primeira_vez_em);

alter table busca_salva add column visto_em timestamptz not null default now();
