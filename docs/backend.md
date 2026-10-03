# Backend do Mimo

Cloudflare Pages (SPA + Pages Functions) · Neon Postgres · Resend.

## Arquitetura

- `functions/api/[[route]].ts`: uma Pages Function catch-all que entrega `/api/*` ao app Hono em `server/app.ts`.
- `server/db`: schema Drizzle (`schema.ts`) e migrations SQL versionadas (`migrations/`). Conexão Neon via WebSocket (`@neondatabase/serverless` Pool), aberta e fechada a cada requisição, com suporte a transações.
- `server/auth`: sessões opacas em cookie httpOnly (`__Host-mimo_session` em produção, SameSite=Lax), só o SHA-256 do token fica no banco; senhas com PBKDF2-SHA256 (WebCrypto, 100k iterações, o máximo do Workers); tokens de e-mail de uso único.
- `server/auth/access.ts`: isolamento por usuário. Toda rota `/accounts/:accountId/*` checa participação (não-membro recebe 404) e toda query filtra por `account_id`. Lançamentos privados do par saem sem descrição/categoria e não podem ser alterados.
- `server/email`: Resend via `fetch`. Sem `RESEND_API_KEY`, os e-mails só aparecem no log.
- Front: `src/lib/api.ts` (cliente), `src/lib/sessao.ts` (sessão), `src/lib/remoto/*` (mapeamento e sincronização). `VITE_DATA_MODE=local` volta ao protótipo com localStorage.

## Rodar localmente

Sem Neon (Postgres local em arquivo, e-mails no terminal):

```bash
pnpm dev:api:local   # API em :8788 com PGlite em .data/pglite
pnpm dev             # Vite em :5173, /api vai para :8788
```

Com Neon (runtime real do Workers):

```bash
cp .dev.vars.example .dev.vars   # preencha DATABASE_URL de um branch de dev
pnpm db:migrate
pnpm build && pnpm dev:api       # wrangler pages dev em :8788
pnpm dev
```

## Migrations

```bash
# depois de alterar server/db/schema.ts
pnpm db:generate     # gera SQL novo em server/db/migrations (commitar)
pnpm db:migrate      # aplica no DATABASE_URL (dev primeiro; produção só depois de revisar)
```

## Segredos e variáveis

| Nome | Onde | Uso |
|---|---|---|
| `DATABASE_URL` | segredo | connection string do Neon (pooler) |
| `RESEND_API_KEY` | segredo | envio de e-mails |
| `CRON_SECRET` | segredo | protege `POST /api/internal/reminders` |
| `APP_URL` | `wrangler.toml` | links dos e-mails e checagem de Origin |
| `EMAIL_FROM` | `wrangler.toml` | remetente (domínio verificado no Resend) |

```bash
wrangler pages secret put DATABASE_URL --project-name mimo
wrangler pages secret put RESEND_API_KEY --project-name mimo
wrangler pages secret put CRON_SECRET --project-name mimo
```

## Lembretes diários

Pages Functions não têm Cron Triggers. Agende uma chamada diária (Worker com cron, GitHub Actions etc.):

```bash
curl -X POST https://SEU-DOMINIO/api/internal/reminders -H "Authorization: Bearer $CRON_SECRET"
```

O mesmo job faz a faxina dos contadores de rate limit vencidos (tabela `rate_limits`, linhas com mais de 24h).

## Rate limiting

Isolates do Workers não compartilham memória, então os limites da aplicação ficam no Postgres (`server/rate-limit.ts`, tabela `rate_limits`): janela fixa por chave, contada com um único `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` (atômico entre requisições concorrentes). A chave guarda só o SHA-256 do sujeito (IP, conta, e-mail). O IP vem de `cf-connecting-ip` (definido pela borda da Cloudflare); IPv6 conta pelo prefixo /64. Sem o cabeçalho (dev local), tudo cai no balde `unknown`. Estouro responde `429 too_many_requests` com `Retry-After` (segundos até a janela reabrir).

| Ação | Limite | Chave |
|---|---|---|
| `POST /auth/signup` | 5 por hora | IP (conta também tentativas com e-mail repetido) |
| Convite: criar ou reenviar | 10 por hora | conta Duo |
| Convite: criar ou reenviar | 20 por hora | IP |
| `POST /auth/password/forgot` | 5 a cada 15 min | IP (429, igual para e-mail com ou sem conta) |
| `POST /auth/password/forgot` | 5 e-mails por hora | endereço (silencioso: segue 202, só não envia) |
| `POST /auth/verify-email/resend` | 5 a cada 15 min | IP |
| `POST /auth/verify-email/resend` | 5 por hora | pessoa |

Os limites padrão estão em `DEFAULT_LIMITS`; os testes podem sobrescrever via `createApp({ limits })`. Os cooldowns por pessoa/convite (reenvio em 30–42s) continuam valendo.

Camada complementar (configurar no deploy): regras de **Rate limiting** do WAF da Cloudflare para `/api/auth/*` e `/api/accounts/*/invites`, que barram floods antes de chegarem à Function e ao banco.

## Endpoints

Auth: `POST /api/auth/{signup,login,logout,verify-email,verify-email/resend,password/forgot,password/reset,password/change}`
Pessoa: `GET|PATCH|DELETE /api/me`, `POST /api/me/onboarding`, `POST /api/me/plan`
Contas: `GET /api/accounts`, `GET|PATCH /api/accounts/:id/settings`, `POST /api/accounts/:id/unlink`
Movimentações: `GET|POST /api/accounts/:id/transactions`, `POST .../batch`, `POST .../mark-paid`, `PATCH|DELETE .../:txId`
Metas: `GET|POST /api/accounts/:id/goals`, `PATCH|DELETE .../:goalId`, `PUT .../:goalId/items`, `POST .../:goalId/contributions`, `DELETE .../contributions/:cid`
Duo: `GET|POST /api/accounts/:id/settlements`, `DELETE .../:sid`; `GET|POST /api/accounts/:id/invites`, `POST .../:inviteId/resend`, `DELETE .../:inviteId`; `GET /api/invites/preview`, `POST /api/invites/{accept,decline}`
Avisos: `GET /api/notifications`, `POST .../:id/read`, `POST .../read-all`, `DELETE .../:id`, `PUT .../receipts`
Investimentos: `GET|POST /api/accounts/:id/investments`, `PATCH|DELETE .../:investmentId`
Interno: `POST /api/internal/reminders`, `GET /api/health`
