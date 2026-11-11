# Componentes — busca e funil

Tokens: `replica/design/tokens.css`. Ícones: Lucide (ISC). Fontes: IBM Plex Sans e Mono (OFL).
Todo texto de interface é nosso. Nenhum rótulo copiado do original.
Base acessível: elementos nativos (`button`, `input`, `select`, `dialog`) e ARIA onde o nativo não basta. Sem dependência de kit de UI.

## Identidade em uma frase
Ferramenta de trabalho, não vitrine: densa e legível, cantos retos (`radius-md` 6 px), verde-petróleo para ação, âmbar só para prazo. Navegação em barra lateral, números em fonte tabular.

---

```
Botao
  variantes  primario, secundario, fantasma, perigo
  tamanhos   sm 32px, md 40px, lg 44px (alvo de toque no celular)
  estados    padrão, hover, ativo, focus-visible (anel 2px focus), desabilitado, carregando
  tokens     primario: bg-accent text-on-accent hover:bg-accent-hover · secundario: bg-bg border-line-strong text-ink
             fantasma: text-accent hover:bg-accent-soft · perigo: bg-danger text-on-accent · radius md · text-sm/600
  a11y       <button> real; carregando = aria-busy + rótulo mantido para leitor de tela; desabilitado nunca é o único aviso
  usado em   todas
```

```
CampoTexto (input, textarea)
  variantes  padrão, com ícone à esquerda, com botão limpar
  estados    vazio, preenchido, foco, erro (borda danger + mensagem), desabilitado
  tokens     bg-bg border-line-strong text-ink placeholder:text-muted radius md h-40px
  a11y       <label> visível sempre; erro ligado por aria-describedby; aria-invalid
  usado em   S01, S02, S03, S05, S08
```

```
BuscaComTermos
  o que é    campo de busca que entende a sintaxe do Postgres: "frase exata", -excluir, ou
  partes     CampoTexto + linha de chips: termos incluídos (accent-soft) e excluídos (danger-soft, prefixo "sem")
  estados    vazio (dica de sintaxe), digitando, com chips, sem resultados
  a11y       chips removíveis com botão "Remover termo X"; Enter busca; Esc limpa
  usado em   S03, S05
```

```
Filtro
  variantes  select múltiplo (UF, modalidade), faixa (valor mínimo/máximo), prazo (encerra em N dias), recorte pronto (chip)
  estados    inativo, ativo (contador "UF · 3"), aberto, limpar
  tokens     chip ativo: bg-accent-soft text-accent-strong border-accent; inativo: bg-bg border-line text-ink
  a11y       grupo com <fieldset>/<legend>; chip é <button aria-pressed>; popover fecha com Esc e devolve foco
  usado em   S03, S06
```

```
LinhaLicitacao (desktop) / CartaoLicitacao (celular < 768px)
  conteúdo   objeto (2 linhas, text-ink), órgão e município/UF (text-muted), modalidade, valor estimado (num),
             encerramento (Prazo), aderência (MedidorAderencia), ação acompanhar
  estados    normal, encerra em breve (Prazo âmbar), encerrada (opacidade e rótulo), já no funil (selo "No funil · etapa"),
             carregando (Esqueleto), sem resultados (EstadoVazio)
  tokens     linha: border-b border-line hover:bg-surface · cartão: bg-bg border-line radius lg shadow-card
  a11y       o objeto é o link para o detalhe; ação acompanhar é botão separado (não aninhado no link)
  usado em   S03, S05
```

```
MedidorAderencia
  o que é    quanto a licitação combina com o ramo, 0 a 100, com o motivo
  visual     barra de 5 segmentos + rótulo textual; nunca só cor
  faixas     alta = success, média = warning, baixa = muted, sem perfil = traço e link "Cadastrar ramo"
  a11y       role="meter" aria-valuenow/min/max + aria-valuetext ("Alta, 82 de 100"); motivos num tooltip acessível por foco
  usado em   S03, S04
  decisão    as faixas (onde termina "baixa" e começa "média") são decisão de produto: função faixaAderencia()
```

```
Prazo
  o que é    data/hora com contagem regressiva legível ("encerra em 2 dias")
  estados    normal (text-muted), até 3 dias (warning, ícone relógio), hoje (warning-soft com texto warning, negrito),
             vencido (danger), sem data (traço)
  a11y       <time datetime=ISO>; texto completo no title e no rótulo para leitor de tela
  usado em   S03, S04, S06, S07
```

```
Selo (badge)
  variantes  neutro (surface-2/ink), accent (accent-soft/accent-strong), sucesso, aviso, perigo
  uso        modalidade, situação no PNCP, etapa, tag, prioridade
  a11y       texto sempre presente; cor é reforço
```

```
QuadroFunil
  colunas    Interesse, Em análise, Vou participar, Proposta enviada, Sessão hoje, Em disputa, Encerrado (com abas Ganhou/Perdeu/Desisti)
  partes     ColunaFunil (bg-surface-2, largura 288px, cabeçalho com contador) + CartaoFunil
  estados    coluna vazia (texto curto + dica), arrastando (sombra drag, coluna alvo realçada), conflito de versão (aviso e recarregar)
  a11y       mover sem arrastar: menu "Mover para…" em cada cartão e atalhos ←/→ com foco no cartão; aria-live anuncia "Movido para Em análise"
  usado em   S06
```

```
CartaoFunil
  conteúdo   objeto curto, órgão/UF, Prazo, prioridade (Selo), tags, avatar do responsável
  estados    normal, prazo próximo, vencido, selecionado, arrastando
  tokens     bg-bg border-line radius md shadow-card; prioridade alta = barra lateral 3px warning
  usado em   S06
```

```
Calendario (prazos)
  variantes  mês, lista (padrão no celular)
  estados    dia vazio, com eventos (pontos por tipo), hoje (anel accent), selecionado
  a11y       grade com role="grid" e navegação por setas; a visão lista é a alternativa simples
  usado em   S07
```

```
Checklist
  item       checkbox nativo + texto editável + remover
  estados    pendente, feito (riscado, text-muted), editando, vazio ("Nenhum item ainda")
  a11y       <input type=checkbox> com <label>; progresso "3 de 5" anunciado
  usado em   S08
```

```
Aviso (toast)
  variantes  sucesso, erro, informação
  comportamento  canto inferior direito (topo no celular), some em 5s, pausa no hover/foco, botão fechar
  a11y       região aria-live="polite" (erro: "assertive")
  usado em   todas
```

```
Esqueleto
  variantes  linha de tabela, cartão, coluna do funil
  tokens     bg-surface-2 com pulso; respeita prefers-reduced-motion
  a11y       aria-hidden; o contêiner tem aria-busy="true"
  usado em   S03, S06
```

```
EstadoVazio
  partes     ícone Lucide, título curto, uma frase, uma ação
  casos      busca sem resultado ("Nada encontrado com esses filtros" + Limpar filtros), funil vazio, sem buscas salvas,
             sem ramo cadastrado, erro ao carregar (com Tentar de novo)
  usado em   S03, S05, S06, S07, S08
```

```
Navegacao (barra lateral)
  itens      Buscar, Alertas, Funil, Prazos, Configurações
  estados    item ativo (bg-accent-soft text-accent-strong + barra 3px accent), hover, recolhida (só ícones)
  celular    vira barra inferior com 4 itens
  a11y       <nav aria-label="Principal">, aria-current="page"
```
