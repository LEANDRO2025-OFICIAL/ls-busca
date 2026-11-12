# LS Busca

Busca de licitações abertas em todo o Brasil (dados oficiais do PNCP), indicador de aderência ao seu ramo e funil de acompanhamento.

## Abrir no navegador (Windows)

1. Instale o [Node.js](https://nodejs.org) LTS, se ainda não tiver.
2. Dê dois cliques em `Abrir LS Busca.bat` (na pasta acima desta).
3. O navegador abre em http://localhost:3000. Crie sua conta em "Criar conta".

Na primeira vez ele instala as dependências e prepara o sistema; demora alguns minutos.
Depois abre em segundos. Feche a janela preta para desligar.

Enquanto o sistema está aberto, uma janela minimizada busca licitações novas no PNCP.
O PNCP limita a taxa de consultas, então uma atualização completa leva cerca de 35 minutos.

## Publicar na internet (Tailscale Funnel)

Com o sistema aberto pelo `.bat`:

```bash
tailscale funnel --bg --https=8443 3000
```

Endereço: https://leandro.taildce077.ts.net:8443 (o computador precisa ficar ligado e com o LS Busca aberto).
Para tirar do ar: `tailscale funnel --https=8443 off`.

O cadastro público fica fechado (veja `CADASTRO_ABERTO` em `.env.example`): novas pessoas entram por Configurações › Equipe.

## Comandos

```bash
npm install
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

- `npm run dev`: modo de desenvolvimento.
- Depois de mudar o código, rode `npm run build` de novo (o `.bat` só monta na primeira vez).
- Não rode `dev` e `start` ao mesmo tempo: os dois usam a mesma pasta de banco (`.data/pglite`).

## Dados

- Sem `DATABASE_URL`, o banco fica em `.data/pglite` (Postgres embutido, PGlite).
- Com `DATABASE_URL` (veja `.env.example`), usa um Postgres de verdade. É o recomendado para uso diário.

### Trava do banco embutido (um processo por vez)

O PGlite só aguenta **um** processo por pasta: dois ao mesmo tempo corrompem o banco. Por isso:

- Antes de abrir `.data/pglite`, o app e todos os scripts criam `.data/pglite.lock` (criação atômica) com PID, porta, nome da máquina e hora de início.
- Se a trava é de um processo vivo, o segundo processo **recusa** com uma mensagem clara e não abre a pasta. Se o dono morreu (queda de energia, `kill -9`), a trava é assumida com um aviso.
- A trava é solta e o banco fechado ao sair (inclusive Ctrl+C e SIGTERM).
- `Abrir LS Busca.bat` nunca sobe um segundo servidor: se o LS Busca já responde na porta 3000, só abre o navegador; se a porta é de outro programa, avisa e sai.
- `Redefinir senha LS Busca.bat` (`npm run redefinir-senha`) recusa, com código de saída 2 e sem tocar no banco, se houver trava ativa ou servidor nas portas 3000/3100 (ajustável com `LS_BUSCA_PORTAS`).
- Nunca apague o `.lock` na mão com o LS Busca aberto. Com `DATABASE_URL` a trava não se aplica.

### Cópias de segurança e restauração

- As cópias ficam em `.data/backups`, com data e hora no nome. Por padrão ficam as 3 mais recentes (`BACKUP_RETENCAO`).
- São feitas sozinhas antes de aplicar uma migração nova, antes de redefinir senha e periodicamente (`BACKUP_INTERVALO_HORAS`, padrão 24). `BACKUP_AUTOMATICO=0` desliga.
- Manual, com o LS Busca **fechado**: `npm run backup`.
- Restaurar, com o LS Busca **fechado**:

```bash
npm run restaurar-backup -- --listar        # só lista as cópias
npm run restaurar-backup                    # lista e pergunta qual restaurar
npm run restaurar-backup -- --ultimo --sim  # restaura a mais recente sem perguntar
```

  A pasta atual não é apagada: fica ao lado, como `pglite-antes-da-restauracao-<data>`.
- As cópias ficam no mesmo disco. Copie `.data/backups` para outro lugar (pendrive, nuvem) de vez em quando.

### Recomendado: migrar para um Postgres de verdade

O banco embutido serve para experimentar. Para uso diário, um Postgres real aguenta vários processos, quedas de energia e tem backup próprio.

1. Crie um banco Postgres: gerenciado (Neon, Supabase, etc.) ou local (instalador do PostgreSQL para Windows; depois `createdb lsbusca`).
2. Copie a URL de conexão, no formato `postgres://usuario:senha@host:5432/lsbusca` (bancos gerenciados costumam exigir `?sslmode=require`).
3. Feche o LS Busca. Copie `.env.example` para `.env.local` e preencha `DATABASE_URL=` com a URL.
4. Abra o LS Busca de novo: as tabelas são criadas sozinhas (migrações) no banco novo, que começa **vazio**.
5. Crie a primeira conta em "Criar conta" e deixe a atualização do PNCP rodar para repopular as licitações.
6. Os dados antigos (contas, funil) continuam em `.data/pglite` e **não** são copiados automaticamente. Guarde a pasta; para voltar ao banco embutido, basta apagar a linha `DATABASE_URL` do `.env.local`.

## Alertas e avisos

- **Alertas** (`/alertas`): qualquer busca (termos, UF, município, modalidade, faixa de valor) pode ser salva como alerta, pela tela de busca ("Salvar alerta") ou pelo formulário da própria página. Dá para pausar, retomar, editar e excluir; cada alerta tem o histórico dos avisos gerados.
- A cada ingestão do PNCP, as licitações que **entraram** na base são casadas com os alertas ativos (`src/lib/casamento.ts`) e geram um **aviso** na tela (sino e página). Cada licitação é avisada uma única vez por alerta (chave única no banco).
- **Webhook opcional**: com `ALERTA_WEBHOOK_URL` definido, os avisos ainda não entregues (das últimas 24 h) são enviados por `POST` com `content-type: application/json`, em remessas de até 50. Tempo limite de `ALERTA_WEBHOOK_TIMEOUT_MS` (padrão 5000). Resposta fora de 2xx, demora ou erro de rede **não derrubam a ingestão**: o aviso continua na tela e o envio é tentado de novo na próxima passada. Não há envio de e-mail.

```json
{
  "evento": "avisos.novos",
  "enviadoEm": "2026-11-10T12:05:00.000Z",
  "avisos": [
    {
      "id": "uuid do aviso",
      "criadoEm": "2026-11-10T12:00:00.000Z",
      "motivo": "contém “cimento”; UF MS",
      "alerta": { "id": "uuid", "nome": "Cimento em MS", "tipo": "busca" },
      "licitacao": {
        "numeroControle": "…",
        "objeto": "…",
        "orgao": "…",
        "uf": "MS",
        "municipio": "Dourados",
        "modalidade": "Pregão - Eletrônico",
        "valorEstimado": 123456.78,
        "encerramento": "2026-11-20T12:00:00.000Z",
        "caminho": "/licitacao/<cnpj>/<ano>/<sequencial>"
      }
    }
  ]
}
```

`alerta.tipo` é `busca` (alerta) ou `comunidade` (interesse no mural de grandes licitações). `valorEstimado` (em reais), `municipio` e `encerramento` podem vir `null`.

## Comunidade de grandes licitações

- `/comunidade` é um mural **interno** com as licitações em aberto de valor estimado a partir de `COMUNIDADE_VALOR_MINIMO` (em reais; padrão R$ 10.000.000), com filtros por UF, município, modalidade e valor mínimo (o filtro só sobe o piso).
- Cada pessoa cadastra os próprios **interesses** (faixa de valor, UF, município, modalidade). Eles usam o mesmo casamento dos alertas: na ingestão, a licitação nova que casa gera um aviso na tela (sino e histórico da página) e entra no mesmo webhook, com `alerta.tipo = "comunidade"`.

## Calendário de prazos

- `/calendario` mostra os prazos das licitações acompanhadas em visão **mensal** ou **semanal** (alternáveis), com legenda por tipo: proposta (fim do envio de propostas do PNCP), sessão, recurso e outros. O tipo dos prazos criados pela equipe vem do título ("Sessão pública", "Recurso"...). Clicar em um prazo abre a licitação.
- **Exportar .ics** (`/calendario/exportar`) baixa os mesmos prazos em iCalendar, para importar em qualquer aplicativo de agenda. A lógica fica em `src/lib/agenda.ts`.

## Robô de lance (modo simulação)

> **Modo simulação. Envio de lances a portais reais não está implementado.** Nada no LS Busca envia lance, abre navegador ou fala com sistema de compras. Todas as disputas são fictícias.

**O que faz**

- `/robo` lista as configurações, as licitações do funil ainda sem robô e o botão de **parada de emergência geral**.
- `/robo/configurar/<id>` configura o robô de uma licitação do funil, item a item: proposta inicial, **piso** (menor preço) ou **desconto máximo** (maior desconto), estratégia, passo, limites e regras da disputa. Salvar exige revisão e confirmação explícita.
- Estratégias: cobrir o melhor lance por passo fixo ou percentual; ficar em 1º com o menor passo aceito; ficar numa posição alvo (ex.: 2º); só lançar nos últimos N segundos (modo aberto com prorrogação); lance final único (modo aberto-fechado).
- "Rodar simulação" disputa contra concorrentes fictícios (agressivo, conservador, que desiste cedo) com relógio virtual e semente: a mesma semente repete a mesma disputa. Suspensão e falhas de comunicação podem ser sorteadas. O resultado (`/robo/simulacao/<id>`) mostra posição final, menor valor atingido, margem sobre o piso, gráfico dos lances, classificação, eventos e a **trilha de decisões** com a regra e o motivo de cada passo.

**Limites de segurança** (motor puro em `src/lib/robo/motor.ts`, sem rede nem relógio do sistema)

- Sem piso o robô não inicia. Nenhuma decisão fica abaixo do piso (ou acima do desconto máximo). Se cobrir exigiria passar dele, o robô lança o piso exato, quando isso ainda cobre o melhor lance, ou para.
- Valores sempre em inteiros (centavos, ou centésimos de ponto percentual), sem erro de ponto flutuante.
- Respeita o intervalo mínimo entre os próprios lances e após o melhor lance, a diferença mínima sobre o próprio lance e sobre o melhor, a variação máxima por lance e o limite de lances por minuto. Os padrões (20 s, 3 s, R$ 0,01) são só valores iniciais: cada disputa tem os seus, configuráveis na tela.
- Parada de emergência geral e por item: a decisão vira "parar" antes de qualquer outra regra. Acionar a geral também marca a parada de cada item; liberá-la **não** religa os itens.
- Paradas automáticas: piso atingido, disputa encerrada ou suspensa, estado inconsistente (melhor lance ausente, relógio voltando, valores inválidos, posição incoerente) e N erros seguidos do conector.
- ME/EPP: o empate ficto (até 5% acima do melhor lance) aparece só como aviso na decisão. O robô nunca age por causa dele.
- A trilha de decisões é só de acréscimo: um gatilho no banco recusa alterar ou apagar linha avulsa (migração `0007_robo_lance.sql`).

**O que falta para um conector real**

O robô fala com a disputa pela interface `ConectorDeDisputa` (`src/lib/robo/conector.ts`: observar o estado, enviar lance). A única implementação é o simulador (`src/lib/robo/simulador.ts`). Os portais não oferecem API pública de lances, e um lance enviado vincula a empresa: um erro pode gerar proposta inexequível e sanção. Um conector real exigiria, para cada portal:

1. Ler os termos de uso do portal e respeitá-los (automação pode ser proibida).
2. Validar no **ambiente de treinamento** do portal, nunca em disputa real, com as regras de tempo e valor daquele sistema.
3. Rodar **na máquina do usuário**, com o certificado e o acesso dele, nunca no servidor do LS Busca.
4. Implementar `observar` e `enviarLance` com tratamento de erro, e manter os mesmos testes de propriedade do motor.

## Testes

```bash
npm test
```

Roda `node --test` sobre `tests/*.test.mjs` (trava, dois processos, `kill -9`, backup/restauração, script de senha, fases do funil, casamento alerta × licitação, calendário `.ics`, robô de lance: motor, simulador, formulário e migração), sempre em pasta temporária fora do repositório.
