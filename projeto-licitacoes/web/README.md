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

- Sem `DATABASE_URL`, o banco fica em `.data/pglite` (Postgres embutido). Faça cópia dessa pasta para não perder contas e funil.
- Com `DATABASE_URL` (veja `.env.example`), usa um Postgres gerenciado.
