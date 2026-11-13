# Proteção e licença do LS Busca

Este documento é honesto de propósito: explica **o que realmente protege** o produto e **o que
não protege**. Serve para você (dono) decidir com clareza e para não prometer ao cliente nada que
a tecnologia não entrega.

## O princípio

O código que roda **no navegador** (HTML, CSS e JavaScript do front-end) é **sempre visível** a
quem usa o sistema. Qualquer pessoa pode abrir as ferramentas do navegador (F12), ver a rede e ler
o que foi entregue. **Isso não tem como ser impedido** — e tentar bloquear F12, botão direito ou
"ver código-fonte" não funciona, atrapalha o uso legítimo e passa uma falsa sensação de segurança.

Portanto, a proteção do produto **não está em esconder o código do navegador**. Está em quatro
camadas reais, descritas abaixo.

## O que protege de verdade

1. **Lógica e dados no servidor.** As consultas, as regras e os dados dos clientes ficam no
   servidor, nunca no navegador. O navegador só recebe o resultado já pronto. Quem copiar o
   front-end não leva a base de licitações, o funil, os alertas nem a lógica de ingestão.

2. **Sessão + licença em toda rota de dados.** Toda leitura e escrita passa por
   `exigirOrganizacao()` (páginas e Server Actions) ou por `autorizarApi()` (route handlers):
   - sem sessão válida → vai para `/entrar` (páginas) ou **401** (API);
   - sem licença vigente (avaliação no prazo ou licença ativa) → vai para `/bloqueio` (páginas)
     ou **403** (API).
   A verificação é **sempre no servidor**, nunca só no navegador. Ver `src/lib/licenca.ts`
   (decisão), `src/lib/dados/licenca.ts` (leitura/gravação) e `src/lib/sessao.ts` (aplicação).

3. **Licença por organização.** Cada conta/órgão tem um estado de licença
   (`avaliacao`, `ativa`, `expirada`, `bloqueada`) e, opcionalmente, uma data de validade.
   O nível máximo (dono do sistema) controla tudo em **`/sistema/licencas`**. Só os e-mails de
   `EMAIL_DONO_SISTEMA` enxergam essa tela; os demais recebem 404. O sistema **nunca** estende um
   teste nem reativa uma licença sozinho.

4. **Contrato (camada jurídica).** A licença de uso restrito, com proibição de cópia, engenharia
   reversa e revenda, é o que dá respaldo para agir se alguém vazar ou copiar. Ver
   `docs/MODELO-LICENCA.md` (modelo; peça revisão de um advogado).

## O que ajuda, mas é só dissuasão (não é barreira)

Estas medidas **dificultam e ajudam a rastrear**, mas não tornam o código "invisível" nem
"impossível de copiar". Não prometa isso a ninguém.

- **Build de produção mais limpo** (`next.config.ts`): `productionBrowserSourceMaps: false`
  (sem mapas de código no navegador) e `compiler.removeConsole` (remove `console.*`, mantém
  `error`/`warn`). O minificador do Next já remove comentários do JS. Isso deixa o bundle menos
  legível — nada além disso.

- **Marca d'água por cliente** (`src/app/layout.tsx`): o valor de `LICENCA_ID` é embutido no HTML
  entregue, em três lugares:
  - um comentário no `<head>`;
  - `<meta name="ls-licenca-cliente" content="…">` no `<head>`;
  - `data-licenca="…"` no elemento `<html>`.
  Use um `LICENCA_ID` **único por cliente**. Se uma cópia do front-end vazar, esse identificador
  diz de qual entrega ela saiu. Vazio = `sem-identificacao`.

- **Limite de requisições** (`src/lib/protecao-api.ts`): freio simples por sessão, **em memória e
  por instância** do servidor — não é compartilhado entre processos nem sobrevive a reinício.
  Reduz abuso automatizado; não substitui as camadas reais.

- **Cabeçalhos de segurança** (`next.config.ts`): `frame-ancestors 'none'` + `X-Frame-Options:
  DENY` (o site não pode ser embutido em iframe de terceiros / clickjacking) e
  `X-Content-Type-Options: nosniff`.

## O que NÃO protege (não se iluda)

- Esconder o JavaScript do navegador — ele é entregue ao usuário e pode ser lido.
- Bloquear F12, botão direito, seleção ou "ver código-fonte" — não impede nada e piora o produto.
- Ofuscar o bundle — atrasa a leitura, não impede a cópia do que está no navegador.
- Minificação/marca d'água — não impedem cópia; servem para dificultar e rastrear.

## Variáveis de ambiente relacionadas

| Variável | Para quê |
| --- | --- |
| `EMAIL_DONO_SISTEMA` | E-mail(s) do dono do sistema (nível máximo), separados por vírgula. Só eles acessam `/sistema/licencas`. Vazio = ninguém. |
| `LICENCA_ID` | Identificador do cliente embutido no HTML (marca d'água). Único por cliente. |
| `CADASTRO_ABERTO` | Mantém o cadastro público fechado (padrão). Novas pessoas entram por Configurações → Equipe. |
| `CRON_SECRET` | Protege `/api/cron/ingerir` em produção (Bearer). |

## Resumo de uma linha

A proteção é **servidor + licença + contrato**, com dissuasão (build limpo, marca d'água, rate
limit, cabeçalhos) por cima. O código do navegador é visível; não prometa o contrário.
