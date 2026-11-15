-- Teste gratuito e licença por organização (a licença é da conta/órgão, não do usuário).
-- Toda rota de trabalho confere, no servidor, se a organização tem avaliação vigente ou
-- licença válida (ver src/lib/licenca.ts e src/lib/sessao.ts). Aditiva e idempotente.
--
-- Estados:
--   avaliacao  -> liberado enquanto now() < trial_fim; depois, bloqueado.
--   ativa      -> liberado; se licenca_expira_em não for nula, só até essa data.
--   expirada   -> bloqueado (licença venceu ou foi encerrada).
--   bloqueada  -> bloqueado (suspensão manual pelo fornecedor).

alter table organizacao
  add column if not exists licenca_estado text not null default 'avaliacao'
    check (licenca_estado in ('avaliacao', 'ativa', 'expirada', 'bloqueada'));

-- Início e fim do teste de 72 h. Novas organizações começam a avaliação na criação.
alter table organizacao add column if not exists trial_inicio timestamptz not null default now();
alter table organizacao add column if not exists trial_fim timestamptz not null default (now() + interval '72 hours');

-- Validade da licença ativa (nula = sem data de expiração).
alter table organizacao add column if not exists licenca_expira_em timestamptz;
-- Anotação interna do fornecedor (nº do contrato, nota fiscal, etc.).
alter table organizacao add column if not exists licenca_observacao text;
-- Quem (nível máximo) mexeu por último na licença e quando.
alter table organizacao add column if not exists licenca_atualizada_em timestamptz;

-- Organizações já existentes na migração: avaliação contada a partir da criação, para não
-- bloquear por engano quem já estava usando antes disto (o fornecedor ativa a licença depois).
-- Rode apenas uma vez (esta migração só roda uma vez); contas criadas depois usam o padrão now().
update organizacao
   set trial_inicio = created_at,
       trial_fim = created_at + interval '72 hours';
