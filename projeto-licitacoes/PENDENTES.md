# Pendentes — LS Busca

Registro de trabalho planejado. Atualizar a cada sessão.

---

## 1. Site / Página de apresentação

A landing page existe (`/apresentacao`) e já é a entrada do sistema. Precisa de polimento antes de ir para produção apresentável a clientes.

### A fazer
- [ ] **Revisão de texto** — ajustar copywriting (nome do produto, proposta de valor, sem referência a Effecti/Conlicitacao)
- [ ] **Identidade visual** — logo definitivo, paleta de cores, tipografia (atualmente Playfair + IBM Plex)
- [ ] **SEO básico** — `og:image`, `twitter:card`, favicon em SVG/PNG, `robots.txt`, `sitemap.xml`
- [ ] **Domínio próprio** — apontar domínio contratado para o Railway
- [ ] **Analytics** — decidir ferramenta (Plausible, Umami ou Vercel Analytics) — sem cookies de rastreamento
- [ ] **Formulário de contato / lista de espera** — opcional: capturar interessados antes do acesso
- [ ] **Página de preços** — se o modelo de licença for público, descrever planos
- [ ] **Responsividade mobile** — testar em dispositivos reais, ajustar breakpoints do CSS de apresentação
- [ ] **Animações de scroll** (`Revelar`) — testar performance, garantir `prefers-reduced-motion`

---

## 2. Railway — implantação de produção

### Já feito
- [x] App Next.js implantado no Railway (branch `main` → auto-deploy)
- [x] Build corrigido (TypeScript pncp.ts, merge conflicts)
- [x] Busca ao vivo do PNCP como fallback quando base vazia

### A fazer
- [ ] **Supabase em produção** — rodar ingestão inicial pelo endpoint `/api/cron/ingerir` para popular a base
  - Requer: `CRON_SECRET` configurado no Railway
  - URL do Railway: a confirmar (o usuário tem acesso ao dashboard)
- [ ] **Variáveis de ambiente no Railway** — conferir que todas estão preenchidas:
  - `DATABASE_URL` (Supabase)
  - `CRON_SECRET`
  - `EMAIL_DONO_SISTEMA`
  - `LICENCA_ID`
  - `CADASTRO_ABERTO` (1 para o primeiro cadastro)
- [ ] **Cron automático** — configurar tarefa periódica (Railway Cron ou externo) para chamar `/api/cron/ingerir` a cada hora
- [ ] **Health check** — Railway já verifica `/`, confirmar que responde 200 (atualmente redireciona para `/apresentacao`, testar se o Railway aceita 3xx)
- [ ] **Domínio customizado** — vincular domínio no Railway após DNS apontar

---

## 3. Base local (dev)

Dois usuários na base PGlite local (`.data/pglite`), com papéis `dono`.
Senhas com hash scrypt — para redefinir, pedir ao assistente para recriar o script `resetar-senha.mjs`
(usa PGlite + `gerarHash` de `src/lib/auth.ts` diretamente).

---

## 4. Busca em tempo real (já implantado)

- 12 modalidades × 500 itens = até 6.000 registros para filtrar localmente
- Lotes de 3 req com 1,2 s de pausa (rate-limit PNCP ~1 req/s)
- Tempo estimado de resposta: ~5 s para 12 modalidades sem UF
- Após ingestão da base, o fallback ao vivo deixa de ser usado automaticamente

---

## 5. Futuras melhorias (backlog)

- [ ] Página de detalhe de licitação ao vivo (atualmente redireciona para o PNCP quando não está na base local)
- [ ] Cache de resultados ao vivo com `revalidate` curto (reduzir chamadas ao PNCP em picos)
- [ ] Notificações push (PWA) como alternativa ao webhook
- [ ] Multi-idioma (PT/ES) — baixa prioridade
- [ ] API pública de busca (para clientes integrarem no próprio sistema)
