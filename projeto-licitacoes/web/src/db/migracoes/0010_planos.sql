-- Planos modulares: cada organização tem um plano que determina quais funcionalidades estão habilitadas.
-- O dono do sistema define o plano na tela de licenças. Organizações já existentes migram para
-- 'completo' para não perder acesso às funcionalidades que já usavam (grandfathering).

alter table organizacao
  add column if not exists plano text not null default 'basico'
    check (plano in ('basico', 'profissional', 'empresarial', 'premium', 'completo'));

-- Organizações já cadastradas ficam no plano completo; novas começam em 'basico'.
update organizacao set plano = 'completo' where plano = 'basico';
