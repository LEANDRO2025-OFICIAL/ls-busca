# Relatório de investigação — VouLicitar (página /entrar)

## 1. Identificação do alvo
- Nome: VouLicitar — plataforma de busca e acompanhamento de licitações públicas
- Origem: HTML **colado pelo usuário no chat** em 2026-10-17 (resposta SSR da rota `/entrar`; `og:url` = `https://web.voulicitar.com`). Não foi feito nenhum acesso de rede ao site.
- Formato: documento HTML + payload RSC (React Server Components) embutido
- Desenvolvedor declarado no rodapé: Chave Mestre Soluções de TI
- Autorização para análise: **pendente de confirmação pelo usuário**

## 2. Objetivo da análise
Não informado. Nesta etapa: identificação passiva da arquitetura a partir do HTML recebido.

## 3. Ambiente e ferramentas
- Leitura manual do HTML colado. O REA **não** foi executado contra este alvo (o HTML colado não foi salvo literalmente como arquivo; ver §9).

## 4. Comandos executados
Nenhum contra o alvo. Ver `comandos.log`.

## 5. Arquitetura e componentes (evidência no HTML)
| Camada | Achado | Evidência |
|---|---|---|
| Framework | Next.js **App Router** com streaming SSR | `/_next/static/chunks/app/entrar/page-*.js`, `self.__next_f.push(...)`, `OutletBoundary`, `MetadataBoundary`, `AsyncMetadataOutlet`, templates `B:0`/`S:0` + `$RC(...)` |
| UI | React + Tailwind CSS, padrão shadcn/ui | classes `bg-card`, `text-muted-foreground`, `focus-visible:ring-ring`, `animate-in fade-in` |
| Ícones | lucide | classes `lucide lucide-search`, `lucide-bell-ring`, `lucide-log-in` |
| Notificações | Sonner (toaster) | `<section aria-label="Notifications alt+T">`, `Toaster` com `richColors`, `position:"top-center"` |
| Fontes | next/font com Plus Jakarta Sans e Inter | `--font-jakarta`, `--font-inter`, classes `__variable_*` |
| CDN/segurança | Cloudflare (challenge platform + Web Analytics) | `window.__CF$cv$params`, `/cdn-cgi/challenge-platform/...`, `static.cloudflareinsights.com/beacon.min.js` |
| PWA / app nativo | manifesto PWA e indícios de *wrapper* nativo | `manifest.webmanifest`, `apple-mobile-web-app-*`, atributos `data-app-nativo`, `data-celular`, `data-so-web="true"`, componente `AppBridge` |
| Build | ID de build Next | `"b":"JR9extQmysFdxsHMRbauI"` |

**Componentes client nomeados no payload RSC:** `AppBridge` (prop `logado:false`), `CelularUX`, `TabelasEmCartoes`, `FormEntrar` (prop `next:"/"`), `GoogleOneTap` (`oneTap:false`), `WhatsAppFlutuante`, `OcultarNoEditor`, `CookieConsent`, `Toaster`, `RastreioPercurso`, `CapturaAtribuicao`, `MetaPixelGlobal`, `RastreioParceiro`, `TelemetriaCliente`.

**Rotas visíveis:** `/entrar`, `/cadastrar`, `/esqueci-senha`, `/consultores`, `/planos`, `/termos`, `/privacidade`, `/cookies`, `/guia`, `/suporte`. Domínios: `voulicitar.com` (institucional) e `web.voulicitar.com` (aplicação).

## 6. Funcionalidades investigadas — Login
- Formulário com `email` (`type=email`, `autoComplete=email`) e `senha` (`type=password`, `autoComplete=current-password`), botão de mostrar senha.
- Campos ocultos: `next` = `/` (redirecionamento pós-login) e `forcar` (sem valor no SSR).
- Checkbox `lembrar=1`: o texto da página diz que sem marcar a sessão termina ao fechar o navegador. Isso indica cookie de sessão versus cookie persistente.
- Botão "Entrar" é renderizado `disabled` no SSR e habilitado após a hidratação.
- Login social Google Identity Services (client ID OAuth público presente no payload), com One Tap desligado.
- Elementos marcados com `data-so-web` aparecem só na versão web (ocultos no app nativo).

## 7. Evidências técnicas
| ID | Afirmação | Evidência |
|---|---|---|
| E1 | Next.js App Router | caminho `chunks/app/entrar/page-160f29badd77f939.js` |
| E2 | Rota de erro e global-error dedicadas | `chunks/app/error-*.js`, `chunks/app/global-error-*.js` |
| E3 | Rastreamento de marketing | componentes `MetaPixelGlobal`, `CapturaAtribuicao`, `RastreioParceiro` |
| E4 | Robots | `<meta name="robots" content="noindex, follow">` na página de login |
| E5 | Cloudflare na frente da origem | `__CF$cv$params`, beacon `cloudflareinsights` |

## 8. Conclusões comprovadas
Front-end em Next.js App Router com React, Tailwind/shadcn, lucide e Sonner, servido atrás da Cloudflare. Autenticação por e-mail e senha ou Google, com opção de sessão persistente.

## 9. Inferências e limitações
- **Inferência:** `AppBridge` + `data-app-nativo` indicam um app móvel que carrega a mesma aplicação web em WebView (ex.: Capacitor). Não comprovado.
- **Inferência:** a versão do Next.js (15.x) é estimada pelos marcadores de streaming e metadata assíncrona. Não comprovada.
- **Inferência:** `RastreioParceiro` sugere um programa de afiliados ou parceiros (`/consultores`).
- **Não resolvido:** endpoint e mecanismo reais de autenticação (server action, rota API ou serviço externo). O HTML não mostra o `action` do formulário, que é tratado no cliente por `FormEntrar`.
- **Limitação:** a análise usa apenas o HTML colado. Os bundles JS não foram lidos. O HTML não foi salvo literalmente, porque a evidência reproduzível exige captura via `rea analyze-web-bundle` ou `export-web-scripts`, com autorização.

## 10. Problemas encontrados e soluções
—

## 11. Arquivos e artefatos gerados
- `investigacoes/2026-10-17-voulicitar-web/relatorio.md` (este arquivo)
- `investigacoes/2026-10-17-voulicitar-web/comandos.log`

## 12. Testes executados e resultados
Nenhum.

## 13. Próximas etapas
1. Confirmar autorização e objetivo (dono/desenvolvedor do sistema ou análise de comportamento público para reconstruir uma funcionalidade em projeto próprio).
2. Com autorização: capturar a página pública com `rea analyze-web-bundle` / `export-web-scripts` e rodar `analyze-javascript-application` sobre os scripts exportados, apenas em rotas públicas. Sem autenticar, sem contornar o desafio Cloudflare.
3. Detalhar a funcionalidade escolhida e, se pedido, reconstruí-la no projeto de destino.
