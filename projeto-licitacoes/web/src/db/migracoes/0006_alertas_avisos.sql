-- Alertas com aviso na própria tela e interesses da comunidade de grandes licitações.
-- Aditiva e idempotente (PGlite e Postgres).

-- 'busca' = alerta de busca salva; 'comunidade' = interesse no mural de grandes licitações.
alter table busca_salva add column if not exists tipo text not null default 'busca';
alter table busca_salva drop constraint if exists busca_salva_tipo_check;
alter table busca_salva add constraint busca_salva_tipo_check check (tipo in ('busca', 'comunidade'));
create index if not exists busca_salva_tipo_idx on busca_salva (organizacao_id, tipo);

-- Aviso in-app: canal 'app'. enviado_em passa a marcar a entrega ao webhook externo (opcional).
alter table aviso drop constraint if exists aviso_canal_check;
alter table aviso add constraint aviso_canal_check check (canal in ('email', 'push', 'app'));
alter table aviso alter column canal set default 'app';
alter table aviso add column if not exists lido_em timestamptz;
create index if not exists aviso_busca_criado_idx on aviso (busca_salva_id, created_at desc);
create index if not exists aviso_nao_lido_idx on aviso (busca_salva_id) where lido_em is null;
