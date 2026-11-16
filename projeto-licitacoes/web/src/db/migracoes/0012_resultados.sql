-- Melhoria 1: resultados (contratações homologadas) do PNCP.
-- Alimenta calibração de aderência, preço de referência e mapa de concorrência.

create table if not exists resultado_licitacao (
  numero_controle        text primary key,
  orgao_cnpj             text,
  uf                     text,
  municipio              text,
  modalidade             text,
  objeto                 text,
  valor_estimado_centavos  bigint,
  valor_homologado_centavos bigint,
  desconto_centesimos    integer,
  data_resultado         timestamptz,
  itens                  jsonb,
  capturado_em           timestamptz not null default now()
);

create index if not exists idx_resultado_uf_modalidade
  on resultado_licitacao (uf, modalidade);

create index if not exists idx_resultado_data
  on resultado_licitacao (data_resultado desc);

create table if not exists resultado_item_vencedor (
  id                      bigserial primary key,
  numero_controle         text not null
    references resultado_licitacao(numero_controle) on delete cascade,
  numero_item             integer,
  descricao               text,
  ni_fornecedor           text,
  nome_fornecedor         text,
  valor_unitario_centavos bigint,
  quantidade              numeric,
  marca                   text
);

create index if not exists idx_item_vencedor_fornecedor
  on resultado_item_vencedor (ni_fornecedor);

create index if not exists idx_item_vencedor_controle
  on resultado_item_vencedor (numero_controle);
