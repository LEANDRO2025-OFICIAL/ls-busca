# Architecture: (nome a definir) — reconstrução da busca e do funil do VouLicitar

Fonte: `replica/recon.md`, `replica/features.csv`. Data: 2026-10-17.
Nada do original é usado: dados vêm direto do PNCP; interface, textos e código são escritos do zero.

## Stack

| camada | escolha | por quê |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript | pedido do usuário; Server Components leem o banco direto, sem API intermediária para as telas |
| estilo | Tailwind + tokens do `/replica-design` | tokens trocáveis na etapa de marca |
| banco | Postgres gerenciado (Supabase ou Neon) | pedido do usuário; FTS em português, `unaccent` e `pg_trgm` disponíveis nos dois |
| ORM | Drizzle | SQL explícito, migrações em arquivo, `tsvector` e `websearch_to_tsquery` via `sql\`\`` sem atrito |
| auth | Supabase Auth (e-mail/senha com verificação, recuperação, Google) | não reinventar fluxo de senha; o `id` do usuário vira `usuario.id` |
| acesso | **verificação na camada de dados** | todo acesso ao Postgres passa pelo servidor; uma função `exigirOrganizacao()` em cada consulta. Portável entre Supabase e Neon |
| e-mail | Resend | alertas transacionais do domínio próprio, com descadastro |
| jobs | Vercel Cron + tabela `ingestao_fatia` como fila | sem fornecedor extra; cada execução cabe no limite de 300 s e retoma de onde parou |
| hospedagem | Vercel | deploy por branch, cron nativo |
| pagamentos | fora do recorte | o original cobra por usuário; entra depois, com Stripe |

## Schema

Tabelas: **14**. Arquivo: `replica/schema.sql`. Acesso: checagem na camada de dados (sem RLS).

| grupo | tabelas |
| --- | --- |
| contas | `organizacao`, `usuario`, `perfil_ramo` |
| dados públicos (compartilhados) | `modalidade`, `licitacao`, `item_licitacao`, `ingestao_fatia` |
| alertas | `busca_salva`, `aviso` |
| funil | `acompanhamento`, `mudanca_etapa`, `checklist_item`, `nota`, `prazo` |

Decisões que o banco garante (não a interface):
- `licitacao.busca` é um `tsvector` gerado com configuração `pt` = português + `unaccent` + radical. Pesos: objeto A, órgão B, complemento C.
- `unique (organizacao_id, numero_controle_pncp)` em `acompanhamento`: a licitação entra uma vez no funil de cada empresa.
- `unique (busca_salva_id, numero_controle_pncp)` em `aviso`: nunca avisar duas vezes a mesma licitação pela mesma busca.
- `acompanhamento.versao`: trava otimista. `update … where id = $1 and versao = $2`; zero linhas = alguém mexeu antes, recarregar.
- `on delete restrict` de `acompanhamento` para `licitacao`: a limpeza da base nunca apaga algo que está no funil.
- `modalidade` é preenchida com `modalidadeId`/`modalidadeNome` que a API devolve. Nenhuma tabela de códigos digitada à mão.
- **Etapas próprias** (diferente do original, que tem uma coluna "Resultado"): `interesse`, `analise`, `decidido_participar`, `proposta_enviada`, `sessao_hoje`, `em_disputa`, e o fim dividido em `ganhou`, `perdeu`, `desistiu`. Isso dá taxa de vitória direto no painel de desempenho.

**Validado em 2026-10-17** no PostgreSQL 17.5 (PGlite) com 10 licitações reais do PNCP: schema aplicado; "CONSERVACAO" casa "conservação"; "limpezas" casa "limpeza"; `-termo` exclui; ranking por `ts_rank`; busca parcial de órgão sem acento; duplicata no funil recusada (23505); etapa inválida recusada (23514); licitação com card não pode ser apagada (23503); aviso deduplicado; trava otimista; trigger `updated_at`; fuso convertido.

## API

### Telas (Server Components, leitura direta no banco)

| rota | tela | quem | lê | fluxo |
| --- | --- | --- | --- | --- |
| `/entrar`, `/cadastrar`, `/recuperar-senha` | S01 | público | — | F01 |
| `/inicio/ramo` | S02 | logado | `perfil_ramo` | F01 |
| `/buscar?q=&uf=&mod=&vmin=&vmax=&encerra=&recorte=&pagina=` | S03 | logado | `licitacao` (FTS + filtros) | F01, F02 |
| `/licitacao/[cnpj]/[ano]/[seq]` | S04 | logado | `licitacao`, `item_licitacao`, `acompanhamento` | F01, F03 |
| `/alertas` | S05 | logado | `busca_salva`, `aviso` | F02 |
| `/funil` | S06 | logado | `acompanhamento` + `licitacao` | F03 |
| `/funil/prazos` | S07 | logado | datas de `licitacao`, `prazo_etapa`, `prazo` | F04 |
| `/funil/[id]` | S08 | logado (mesma org) | `acompanhamento`, `checklist_item`, `nota`, `prazo`, `mudanca_etapa` | F03 |
| `/funil/desempenho` | S09 | logado | agregados de `acompanhamento`, `mudanca_etapa` | — |

A rota do detalhe usa `cnpj/ano/seq` porque o número de controle do PNCP contém `/`.

### Ações (Server Actions, todas validadas com zod e com `exigirOrganizacao()`)

| ação | faz | quem | entrada | saída | fluxo |
| --- | --- | --- | --- | --- | --- |
| `salvarPerfilRamo` | grava termos, exclusões, UFs, modalidades | admin/dono | arrays | perfil | F01 |
| `salvarBusca` | cria/edita busca salva | membro | nome, texto, filtros | busca | F02 |
| `alternarAlerta` | liga/desliga e muda frequência | dono da busca | id, ativo, frequência | busca | F02 |
| `excluirBusca` | apaga busca e seus avisos | dono da busca | id | ok | F02 |
| `acompanhar` | cria card em `interesse` (idempotente: `on conflict do nothing`) | membro | numeroControle | card | F03 |
| `moverCard` | muda etapa/posição, grava `mudanca_etapa` | membro | id, etapa, posição, versão | card ou conflito | F03 |
| `editarCard` | prioridade, tags, responsável, prazo da etapa | membro | id, campos, versão | card ou conflito | F03 |
| `itemChecklist` | criar, marcar, reordenar, apagar | membro | id, texto/feito/ordem | item | F03 |
| `adicionarNota` | nota no processo | membro | id, texto | nota | F03 |
| `adicionarPrazo` | prazo manual | membro | id, título, quando | prazo | F04 |
| `convidarUsuario` | convite por e-mail para a organização | admin/dono | e-mail, papel | convite | — |

### Rotas HTTP

| método caminho | faz | quem |
| --- | --- | --- |
| `GET /api/cron/semear` | cria as fatias de ingestão do ciclo (a cada 3 h) | Vercel Cron (`CRON_SECRET`) |
| `GET /api/cron/ingerir` | processa fatias pendentes até ~240 s (a cada 5 min) | Vercel Cron |
| `GET /api/cron/alertas` | casa licitações novas com buscas ativas e envia e-mails | Vercel Cron |
| `GET /api/cron/limpeza` | remove licitações encerradas há mais de 180 dias sem card nem aviso (semanal) | Vercel Cron |
| `GET /alertas/sair/[token]` | descadastro em 1 clique; token opaco assinado, sem e-mail na URL | público |

Webhooks de entrada: nenhum (pagamentos fora do recorte). Saída: e-mails via Resend.

### Chamadas à fonte oficial (só APIs públicas, sem chave)

| uso | endpoint | parâmetros |
| --- | --- | --- |
| carga das abertas | `GET https://pncp.gov.br/api/consulta/v1/contratacoes/proposta` | `dataFinal=yyyyMMdd` (hoje + 60 dias), `codigoModalidadeContratacao`, `pagina`, `tamanhoPagina=50` |
| mudanças (retificação, suspensão, cancelamento) | `GET …/v1/contratacoes/atualizacao` | `dataInicial`, `dataFinal`, `codigoModalidadeContratacao` (obrigatório), `pagina` |
| itens | API PNCP principal, `…/orgaos/{cnpj}/compras/{ano}/{seq}/itens` | **não verificado**: confirmar antes do marco 3 |

## Jobs

| job | quando | o que faz |
| --- | --- | --- |
| semear | a cada 3 h | para cada modalidade conhecida, `insert … on conflict do nothing` numa fatia `proposta` do ciclo; uma vez por dia, fatias `atualizacao` de ontem a hoje |
| ingerir | a cada 5 min | pega uma fatia com `for update skip locked`, baixa página a página (1 requisição por segundo), faz *upsert* em `licitacao`, avança `proxima_pagina`; para em ~240 s e deixa o resto para a próxima execução |
| alertas | após cada ingestão concluída (imediata) e 07:00 de Brasília (diária) | para cada busca ativa, `websearch_to_tsquery` + filtros sobre licitações com `ingerido_em > ultimo_alerta_em`; `insert into aviso … on conflict do nothing returning *`; um e-mail por usuário com tudo o que é novo e o motivo de cada item |
| limpeza | semanal | apaga licitações encerradas há mais de 180 dias sem `acompanhamento` nem `aviso` |

Volume esperado: cerca de 34 mil abertas no país (número exibido pelo original) ÷ 50 por página ≈ 700 requisições por carga completa.

## The parts that bite

- **Fuso horário**: o PNCP manda datas sem offset (`2026-10-23T08:59:00`). Gravamos como horário de Brasília (`at time zone 'America/Sao_Paulo'`). **Risco:** órgãos de MS, MT, RO, AC, AM e RR (UTC−4/−5) podem estar informando a hora local. Comparar com um edital real de MS antes de mostrar "encerra em 2 horas"; o JSON original fica em `licitacao.bruto` para reprocessar sem nova chamada.
- **Idempotência**: *upsert* por `numero_controle_pncp`; fatias com `unique`; avisos com `unique`; `acompanhar` com `on conflict do nothing`. Rodar um job duas vezes não duplica nada.
- **Concorrência**: dois usuários no mesmo card → trava otimista por `versao`. Dois workers na mesma fatia → `for update skip locked` + `bloqueada_ate`.
- **Limites da fonte**: página máxima de 50 e limite de taxa não documentado. 1 requisição por segundo, *backoff* exponencial em 429/5xx, `User-Agent` identificando o projeto com um e-mail de contato.
- **Busca**: a API não busca por texto, então a busca é toda no nosso Postgres. `websearch_to_tsquery('pt', …)` aceita `"frase exata"`, `-excluir` e `or`. Número de processo e órgão parciais usam trigramas.
- **Aderência**: regra de pontuação ainda indefinida (decisão de produto, ver Build order 2).
- **Multi-tenant**: tudo que a empresa cria tem `organizacao_id`, e toda consulta filtra por ele via `exigirOrganizacao()`. Teste obrigatório: um segundo usuário de outra organização recebe 404 em `/funil/[id]`.
- **E-mail**: domínio próprio verificado (SPF, DKIM, DMARC), descadastro em 1 clique, nada de dados pessoais na URL.
- **LGPD**: exclusão de conta apaga a organização em cascata. Os dados de licitação são públicos e ficam.

## Build order

1. **Fatia vertical** — prova a stack ponta a ponta, feio mesmo:
   telas S01, S03, S04, S06 · tabelas `organizacao`, `usuario`, `modalidade`, `licitacao`, `ingestao_fatia`, `acompanhamento` · `semear` + `ingerir` só para pregão eletrônico em uma UF · busca por texto · botão "acompanhar" · funil com as colunas.
2. **Must-haves**:
   - busca: incluir/excluir, filtros (UF, modalidade, prazo), órgão/processo, lista responsiva com estados vazio/carregando/erro;
   - **aderência**: `lib/aderencia.ts` com `calcularAderencia(licitacao, perfil) → { pontuacao: 0..100, motivos: string[] }`. Esta regra fica para o usuário escrever (é onde o conhecimento de licitações dele entra);
   - S02 perfil do ramo; ingestão de todas as modalidades e UFs; `atualizacao` diária;
   - funil completo (mover em um clique, `mudanca_etapa`), S07 calendário de prazos;
   - organização com vários usuários; salvar busca.
3. **Should-haves**: alertas por e-mail com motivo, recortes prontos, filtro por valor, prioridade/tags/responsável, filtros do funil, prazo por etapa, S08 checklist e notas, login com Google. Verificar o endpoint de itens do PNCP.
4. **Could-haves**: busca e aderência por item, push, S09 desempenho (taxa de vitória pelas etapas `ganhou`/`perdeu`).
5. **Melhorias do `/replica-entrepreneur`**, quando rodar.
