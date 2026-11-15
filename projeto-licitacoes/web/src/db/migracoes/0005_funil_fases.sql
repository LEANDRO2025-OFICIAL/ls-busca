-- Funil completo: etapas depois de "ganhou" (homologação e contrato).
-- Aditiva e idempotente: só troca o check de acompanhamento.etapa por um que aceita as novas.
alter table acompanhamento drop constraint if exists acompanhamento_etapa_check;
alter table acompanhamento add constraint acompanhamento_etapa_check check (etapa in (
  'interesse', 'analise', 'decidido_participar', 'proposta_enviada',
  'sessao_hoje', 'em_disputa', 'ganhou', 'homologacao', 'contrato', 'perdeu', 'desistiu'
));
