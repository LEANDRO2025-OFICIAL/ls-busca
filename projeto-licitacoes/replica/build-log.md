# Build log

| tela | data | estado | o que falta | mais difícil que o esperado |
| --- | --- | --- | --- | --- |
| Base de dados | 2026-10-17 | feito | trocar PGlite por Postgres gerenciado no deploy | `unique` com coluna nula não impedia duplicata: corrigido com `nulls not distinct` (schema.sql) |
| Ingestão PNCP | 2026-10-17 | parcial | outras modalidades e UFs; `/contratacoes/atualizacao` | nada: 239 registros reais em 17,7 s, segunda chamada idempotente |
| S03 Buscar | 2026-10-17 | parcial | filtros de UF, modalidade e valor; aderência; estado de erro; conferir 390 px | Cache Components do Next 16 exige leitura do banco dentro de `<Suspense>` com `connection()` |
| S04 Detalhe | 2026-10-17 | feito | itens da licitação (endpoint ainda não verificado) | — |
| S06 Funil | 2026-10-17 | parcial | editar prioridade, tags, responsável e prazo; filtros | constantes de etapa num arquivo `"use client"` não servem a Server Components: movidas para `lib/etapas.ts` |
| S01, S02, S05, S07, S08, S09 | 2026-10-17 | stub | telas em construção (rotas existem para a navegação não quebrar) | — |

## 2026-10-18 — ramo, login e Brasil inteiro

| item | estado | verificação | mais difícil que o esperado |
| --- | --- | --- | --- |
| S02 Ramo + aderência | feito | ramo salvo pelo formulário; "Meu ramo" trouxe 9 de 239 (MS) com nota e motivos; termo excluído tirou a do hospital | arrays JS viram vários parâmetros no `sql` do Drizzle: passados como um JSON só (`listaTexto`) |
| Login próprio | parcial | sem cookie → 307 para /entrar; cookie falso → redireciona sem dados; cadastro → /inicio/ramo; senha errada → aviso; e-mail em maiúsculas entra; sair encerra; conta nova não vê funil de outra empresa | falta verificação de e-mail e recuperação de senha (precisam de provedor de e-mail); limite de 5 tentativas não exercitado |
| DATABASE_URL (pg) | parcial | compila; não testado contra Postgres real (sem conta de banco gerenciado) | executor comum para migrações em PGlite e pg |
| Filtros UF, modalidade, valor | feito | tipos e lint ok; SQL junto com a aderência | — |
| Ingestão nacional | feito | 29.664 abertas na base; filtro SP + Dispensa + até R$ 50 mil → 657, todas SP e abaixo do teto. Corrigidos: timeout não era retentado; fatia parada por tempo ficava travada 5 min e encerrava o laço antes do fim | **PNCP limita taxa**: 429 perto de 1 req/s, sem Retry-After, libera em <15 s. Pausa subiu para 2,5 s e 429 espera 20–80 s |

## Verificação desta fatia

- `tsc`, ESLint e `next build`: sem erros. Busca, funil e detalhe saem como Partial Prerender.
- Busca com dados reais: "limpeza" 8, "limpeza -hospitalar" 7, "LIMPEZA" 8, "higienizacao" 2, recorte de 7 dias 115 de 239.
- Acompanhar → aparece "No funil · Triagem" na busca. Mover etapa → persiste após recarregar (versão 1 → 2 → 3 nos logs).
- **Não verificado no navegador:** o desfazer da interface quando há conflito de versão (a janela estava oculta e as abas em segundo plano não hidratavam). A regra no banco foi testada no PGlite.
- **Sem commits:** a pasta ainda não é um repositório git.
