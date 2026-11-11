# Recon map: VouLicitar (web)

Escopo: **busca de licitações** (com buscas salvas e alertas) e **funil de acompanhamento** (quadro por etapas, prazos, página do processo).
Para: produto próprio do usuário, com funcionalidades, interface, código e marca próprios.
Data: 2026-10-17
Método: sala limpa. Somente páginas públicas, lidas manualmente. A área logada (`/buscar`, `/acompanhamentos`) redireciona para `/entrar` e **não foi acessada**. Nenhum bundle JS lido, nenhuma chamada de rede do original registrada.

## Sources

| # | fonte | URL | notas |
| --- | --- | --- | --- |
| 1 | site institucional (home) | https://voulicitar.com/ | descreve os 6 passos da rotina, os recursos da busca (filtros, aderência, alertas) e as etapas do funil; mostra telas de demonstração com empresa fictícia |
| 2 | preços | https://voulicitar.com/ (seção Planos) | plano único com tudo liberado, preço por usuário, R$ 89 a R$ 59/mês conforme o período, teste de 3 dias sem cartão (lido em 2026-10-17) |
| 3 | termos de uso | https://web.voulicitar.com/termos | interface, marca e código são da Chave Mestre; dados de contratações são de domínio público; proíbe scraping, extração da base e reprodução do serviço |
| 4 | guia público | https://web.voulicitar.com/guia | guia genérico sobre licitações (Lei 14.133), não é manual do produto |
| 5 | HTML da página de login | colado pelo usuário | stack e componentes; ver `rea-workbench/investigacoes/2026-10-17-voulicitar-web/relatorio.md` |
| 6 | **API pública de Consultas do PNCP** (fonte oficial) | https://pncp.gov.br/api/consulta/v3/api-docs | OpenAPI 3.0.1, Serpro; verificado com 1 chamada real: sem autenticação, HTTP 200 |
| 7 | conta do usuário | — | o usuário não tem conta; os termos vedam scraping e reprodução, então nada de conta para isso |

**Conclusão dos termos:** reconstruir comportamento com interface, textos, código e marca próprios, e com dados **obtidos direto do PNCP** (domínio público), nunca da base do VouLicitar.

## Core loop

A empresa cadastra o que vende, recebe e encontra as licitações abertas que combinam com isso, e acompanha cada uma por etapas até o resultado, sem perder prazo.

## Screens

Observadas apenas pelas descrições e telas de demonstração da home (fonte 1), salvo indicação. "states seen" lista o que foi visto; estados que precisam existir estão em `notes` da matriz.

| ID | tela | rota / como chegar | propósito | componentes-chave | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Entrar / Criar conta | `/entrar`, `/cadastrar`, `/esqueci-senha` | autenticação por e-mail/senha ou Google; "continuar conectado" | formulário, botão social, link de recuperação | preenchido (observado diretamente no HTML), botão desabilitado até carregar |
| S02 | Cadastro do ramo | onboarding após criar conta ("cadastre o seu ramo") | dizer o que a empresa vende e onde atua | lista de produtos/termos, seleção de UFs/regiões | — (inferido) |
| S03 | Buscar licitações | `/buscar` | encontrar editais abertos | campo de busca (objeto, item, órgão, nº do processo), termos a incluir e a excluir, filtros (UF, região, modalidade, valor, prazo), recortes prontos ("meu ramo", "encerrando em 7 dias"), lista de resultados com indicador de aderência, total de abertas | filled (demo); loading com skeleton (visto no HTML); tabelas viram cartões no celular (componente `TabelasEmCartoes`) |
| S04 | Detalhe da licitação | `/licitacao/…` | ver objeto, órgão, datas, valor, itens e edital; decidir se acompanha | cabeçalho com situação e prazos, lista de itens, link para o edital/sistema de origem, ação de acompanhar | — (rota vista na demo de preços) |
| S05 | Buscas salvas e alertas | a partir de S03 ("salve a busca e crie alertas") | receber só o que é novo | lista de buscas, liga/desliga alerta, motivo de cada aviso ("por que aquele edital apareceu") | — (inferido) |
| S06 | Funil | `/acompanhamentos` (aba Funil) | ver todos os processos por etapa | quadro com colunas: Interesse, Analisando, Vou participar, Proposta enviada, Pregão hoje, Em disputa, Resultado; mudar de etapa com um clique; filtros por prioridade, estado e tag; prazo por etapa | filled (demo) |
| S07 | Prazos | `/acompanhamentos` (aba Prazos) | calendário que junta todos os prazos | calendário/lista por data | — (aba vista) |
| S08 | Processo | `/acompanhamentos/…` (aba Processo) | página por processo | checklist, notas, responsável, documentos | — (aba e rota vistas) |
| S09 | Desempenho | `/acompanhamentos` (aba Desempenho) | resultados do funil | indicadores (palpite: taxa de participação e de vitória) | — (só o nome da aba) |

## Flows

```
F01 Encontrar licitações do meu ramo
    S01 cadastro -> S02 ramo -> S03 recorte "meu ramo" -> S04 detalhe
    happy path clicks: ~4 depois do cadastro (estimado; não observado)
    edge: nenhum resultado; termo com acento/sem acento; termos excluídos zeram a lista;
          licitação suspensa ou encerrada entre a busca e o clique; API do PNCP lenta ou fora
F02 Salvar uma busca e ser avisado
    S03 busca com filtros -> salvar -> S05 ligar alerta -> e-mail/push com apenas as novas
    happy path clicks: 3
    edge: mesma licitação casando com duas buscas (aviso duplicado); edital retificado
          (é "novo"?); usuário sem e-mail verificado; descadastrar do e-mail com 1 clique
F03 Acompanhar uma licitação no funil
    S03/S04 acompanhar -> S06 entra em "Interesse" -> mover etapas -> S08 checklist, notas, responsável
    happy path clicks: 2 para entrar no funil, 1 por mudança de etapa
    edge: adicionar a mesma licitação duas vezes; dois usuários movendo o mesmo card;
          licitação cancelada no PNCP com card ativo; prazo vencido na etapa
F04 Não perder prazo
    S06 -> S07 calendário; datas de abertura/encerramento vindas do PNCP + prazos manuais por etapa
    edge: fuso (horários do PNCP sem offset, tratar como horário de Brasília); prazo alterado por retificação
```

## Components

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Campo de busca | simples, com incluir/excluir | vazio, digitando, com chips | S03, S05 |
| Filtro | select múltiplo (UF, modalidade), faixa (valor), data (prazo), recorte pronto (chip) | ativo, inativo, limpar | S03, S06 |
| Cartão/linha de licitação | linha de tabela (desktop), cartão (celular) | normal, encerrando em breve, encerrada, já no funil | S03, S05 |
| Indicador de aderência | barra ou percentual | alto, médio, baixo, sem perfil | S03 |
| Quadro kanban | colunas fixas por etapa | vazio por coluna, arrastando, contador | S06 |
| Card do funil | com prioridade, tag, responsável, prazo | normal, prazo próximo, vencido | S06 |
| Calendário | mês, lista | dia vazio, com eventos | S07 |
| Checklist | item | pendente, feito | S08 |
| Toast | sucesso, erro | — | todas (Sonner no original) |
| Skeleton | lista, cartões | loading | S03, S06 |

## Inferred data model

```
Organizacao   id, nome, cnpj
              evidence: termos ("organização multiusuário"), preço por usuário
              confidence: high
Usuario       id, organizacao_id, nome, email, papel
              evidence: termos (Conta vinculada a empresa), S01
              confidence: high
PerfilRamo    id, organizacao_id, termos[] (produtos), termos_excluidos[], ufs[], modalidades[]
              evidence: "cadastre produtos, regiões e buscas salvas"
              confidence: medium
Licitacao     numero_controle_pncp (pk), cnpj_orgao, ano, sequencial, objeto, informacao_complementar,
              modalidade_id, modo_disputa_id, situacao_id, valor_estimado, srp,
              data_abertura, data_encerramento, data_publicacao, data_atualizacao,
              uf, municipio, codigo_ibge, orgao_nome, unidade_nome, link_origem
              evidence: API PNCP /v1/contratacoes/proposta (campos reais, fonte 6)
              confidence: high (é o formato da fonte oficial)
ItemLicitacao licitacao_id, numero, descricao, quantidade, unidade, valor_unitario_estimado
              evidence: "busca por item", "aderência por item"; endpoint de itens fica na API PNCP principal (não verificado)
              confidence: medium
BuscaSalva    id, usuario_id, nome, texto, incluir[], excluir[], filtros (json), alerta_ativo, frequencia
              evidence: "salve a busca e crie alertas"
              confidence: high
Aviso         id, busca_id, licitacao_id, motivo, enviado_em, canal (email | push)
              evidence: "cada aviso mostra por que aquele edital apareceu"
              confidence: medium
Acompanhamento id, organizacao_id, licitacao_id (unique por org), etapa, prioridade, tags[],
              responsavel_id, prazo_etapa, criado_por
              etapa in (interesse, analisando, vou_participar, proposta_enviada, pregao_hoje, em_disputa, resultado)
              evidence: S06 (etapas listadas literalmente na home), filtros por prioridade/estado/tag
              confidence: high
ChecklistItem acompanhamento_id, texto, feito, ordem         evidence: S08   confidence: high
Nota          acompanhamento_id, autor_id, texto, criado_em  evidence: S08   confidence: high
MudancaEtapa  acompanhamento_id, de, para, usuario_id, em    evidence: nenhuma (palpite, útil para S09)   confidence: guess
```

Relacionamentos: Organizacao 1-n Usuario; Organizacao 1-1 PerfilRamo; Usuario 1-n BuscaSalva; BuscaSalva 1-n Aviso; Licitacao 1-n ItemLicitacao; Organizacao 1-n Acompanhamento; Licitacao 1-n Acompanhamento; Acompanhamento 1-n ChecklistItem, Nota, MudancaEtapa.

**Fatos da fonte oficial (verificados em 2026-10-17):**
- `GET https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=yyyyMMdd&pagina=1` retorna as contratações com proposta em aberto, sem token. Filtros opcionais: `codigoModalidadeContratacao`, `uf`, `codigoMunicipioIbge`, `cnpj`. `tamanhoPagina` de 10 a 50.
- Teste: pregão eletrônico (`codigoModalidadeContratacao=6`), UF MS → 211 registros, 22 páginas. Situação `1` = "Divulgada no PNCP".
- **A API não tem busca por texto.** A busca por objeto/item, os termos a excluir e a aderência exigem ingerir os dados num banco próprio, com índice de texto em português.

## Feature matrix

Ver `features.csv`. Must: 18, should: 9, could: 4, skip: 3 (validado com `parity.py`: 30 contadas; "Histórico de mudanças de etapa" fica fora por ser extra nosso).

## Out of scope (cannot or should not be cloned)

- **A base de dados do VouLicitar**: os termos vedam extração; a nossa vem direto do PNCP.
- **Marca, interface, textos e telas** do original: propriedade da Chave Mestre.
- **A comunidade/grupo de WhatsApp** e o programa de consultores: rede deles, não funcionalidade.
- Fora do recorte escolhido (podem virar projetos futuros): pesquisa e formação de preço, jurídico, documentos/editor, cofre de certidões, concorrentes e atas, mapa, panorama, app nativo.

## Size

Telas 9, fluxos 4, entidades 11. Partes difíceis:
1. **Ingestão incremental do PNCP**: paginação de no máximo 50, sem busca textual, campos de atualização (`/contratacoes/atualizacao`) para pegar retificações e mudanças de situação.
2. **Busca e aderência**: índice de texto em português (acentos, plurais), termos a excluir, pontuação de quanto cada licitação combina com o ramo.
3. **Alertas sem duplicar**: job periódico, deduplicação por busca e licitação, motivo do aviso, e-mail com descadastro.

Tamanho: **M** (algumas semanas) para busca + funil + alertas por e-mail. Itens por licitação dependem da API principal do PNCP, ainda não verificada.
