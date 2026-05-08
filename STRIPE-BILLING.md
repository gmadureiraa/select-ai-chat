# Stripe Billing — KAI 2.0

Implementação multi-tenant de planos + cobrança via Stripe Checkout + Customer Portal.

## Resumo do que foi entregue

- **Migration** `migrations/0006_seed_plans.sql` — popula `subscription_plans` com 4 tiers (Free / Starter / Pro / Enterprise) idempotente via `ON CONFLICT (type) DO UPDATE`.
- **3 handlers de API** em `api/_handlers/`:
  - `stripe-create-checkout.ts` — cria Checkout session no modo `subscription`.
  - `stripe-webhook.ts` — sincroniza eventos da Stripe com `workspace_subscriptions` + `workspace_tokens` + `token_transactions`.
  - `stripe-portal.ts` — abre Customer Portal pra gerenciar/cancelar.
- **Hooks React** em `src/hooks/useSubscription.ts` — `useSubscription`, `useWorkspaceTokens`, `useSubscriptionPlans`, `useTokenTransactions`.
- **UI** em `src/components/billing/BillingTab.tsx` — 3 cards (assinatura atual, planos disponíveis, histórico de transações).
- **Integração** — tab `billing` no `Kai.tsx` (gated a owner), item "Plano e cobrança" na sidebar Workspace.

## Tabela de planos seeded

| Plano       | Mensal     | Anual      | Tokens/mês | Clientes  | Membros | Features extras                          |
|-------------|-----------:|-----------:|-----------:|----------:|--------:|------------------------------------------|
| Free        | R$  0      | R$ 0       |        100 |         1 |       1 | —                                        |
| Starter     | R$ 97      | R$ 873     |      1.000 |         3 |       2 | viral_carousel, viral_reels              |
| Pro         | R$ 297     | R$ 2.673   |      5.000 |        10 |       5 | + viral_radar                            |
| Enterprise  | R$ 997     | R$ 8.973   |     25.000 | ilimitado | ilim.   | + sla                                    |

Anual ≈ 9× o mensal (~25% desconto).

`features` JSONB usa flags booleanas: `viral_carousel`, `viral_reels`, `viral_radar`, `sla`. `max_clients = -1` e `max_members = -1` representam "ilimitado".

## Variáveis de ambiente

### Obrigatórias pra Stripe rodar

```
STRIPE_SECRET_KEY=sk_live_...           # ou sk_test_... em dev
STRIPE_WEBHOOK_SECRET=whsec_...         # do dashboard Stripe (Webhook signing secret)
APP_URL=https://app.kaleidos.com.br     # base pro success/cancel/return URL
```

### Price IDs por plano (necessárias antes do checkout funcionar)

Como o schema `subscription_plans` só tem 1 coluna `stripe_price_id` mas precisamos suportar tanto mensal quanto anual, o handler resolve o price ID por env var primeiro:

```
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
```

Free não precisa — o handler bloqueia checkout pra `type='free'` com erro explícito.

Fallback: se a env var não existir, usa `subscription_plans.stripe_price_id` (cobre mensal apenas).

### Fallback defensivo

Se `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` ausentes, os handlers retornam **HTTP 503** com mensagem explicativa em vez de crashar. Frontend (`BillingTab`) lida via toast.

## Endpoints

### `POST /api/stripe-create-checkout`
**Auth:** Bearer JWT (Neon Auth). Apenas owner do workspace.
**Body:**
```json
{ "plan_id": "uuid", "billing_period": "monthly" | "yearly", "workspace_id": "uuid" }
```
**Resposta:** `{ "url": "https://checkout.stripe.com/...", "session_id": "cs_..." }`

Cria Checkout em `mode: 'subscription'`. Reaproveita `stripe_customer_id` se o workspace já teve assinatura (evita duplicar customers). Adiciona metadata pra rastrear no webhook.

### `POST /api/stripe-webhook`
**Auth:** Stripe-Signature header (HMAC). Não usa `authedPost`.
**Eventos handled:**
- `checkout.session.completed` → cria/atualiza `workspace_subscriptions` e credita `tokens_monthly` em `workspace_tokens` + grava `token_transactions(type='subscription_credit')`.
- `customer.subscription.updated` → sincroniza status, period, `cancel_at_period_end`. Se mudou de plano, credita novos tokens (reset).
- `customer.subscription.deleted` → marca `status='canceled'` + `cancel_at_period_end=true`.

Resolve plano pelo `metadata.plan_id` → `metadata.plan_type` → `stripe_price_id` (em ordem).

Mapeia status Stripe → enum interno: `active`/`trialing`/`canceled`/`past_due`. Status `incomplete`, `incomplete_expired`, `unpaid`, `paused` → `past_due`.

### `POST /api/stripe-portal`
**Auth:** Bearer JWT. Apenas owner.
**Body:** `{ "workspace_id": "uuid" }`
**Resposta:** `{ "url": "https://billing.stripe.com/p/session/..." }`

Abre Customer Portal pro `stripe_customer_id` do workspace. Erro 400 se workspace não tem assinatura ainda.

## Como o frontend usa

1. Owner navega pra `Workspace → Plano e cobrança` na sidebar.
2. `BillingTab` mostra:
   - **Card 1:** plano atual + status + tokens disponíveis + uso mensal (Progress bar) + botão "Gerenciar" (chama `stripe-portal`).
   - **Card 2:** grid 4-up com Free/Starter/Pro/Enterprise. Toggle Mensal/Anual. Badge "Plano atual". Botão "Assinar" / "Mudar de plano" chama `stripe-create-checkout` e redireciona.
   - **Card 3:** tabela das últimas 15 `token_transactions` com tipo (badge colorido), quantidade, balance_after, descrição.
3. Após Stripe success → redirect pra `/?stripe=success&session_id=...` (handler de URL query no frontend pode fazer toast).
4. Cancelamento → portal → webhook `subscription.deleted` → DB sincronizado.

## Configuração no Stripe (TODO Gabriel)

Antes de produção, criar no Stripe Dashboard:

1. **Products** (4): Free, Starter, Pro, Enterprise.
2. **Prices** (6, exceto Free):
   - Starter Monthly R$ 97 / Yearly R$ 873
   - Pro Monthly R$ 297 / Yearly R$ 2.673
   - Enterprise Monthly R$ 997 / Yearly R$ 8.973
3. Copiar os `price_xxx` pra Vercel env vars (lista acima).
4. **Webhook endpoint:** `https://app.kaleidos.com.br/api/stripe-webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Copiar o `Signing secret` (whsec_…) pra `STRIPE_WEBHOOK_SECRET` no Vercel.
5. **Customer Portal:** ativar no Dashboard → Settings → Billing → Customer Portal. Configurar features (cancel, update payment, switch plans).

## Bloqueios conhecidos

- **Stripe não configurado** — handlers retornam 503 até `STRIPE_SECRET_KEY` existir. Esperado em dev.
- **Schema com apenas 1 `stripe_price_id` por plano** — mantemos Price IDs em env vars enquanto não há migração que adiciona `stripe_price_id_monthly` e `stripe_price_id_yearly`.
- **Anti-fraude / proration** — não tratamos cenários edge como "cliente assina Pro logo após Starter no mesmo mês". Stripe lida com proration automático e o webhook recebe `subscription.updated` com novo period.
- **Tokens não acumulam entre ciclos** — handler `upsertSubscription` resetta `balance` para `tokens_monthly` no início de cada ciclo. Se Gabriel quiser carry-over, mudar pra `balance = balance + tokens_monthly`.

## Arquivos criados/modificados

```
+ migrations/0006_seed_plans.sql
+ api/_handlers/stripe-create-checkout.ts        ( ~135 LOC)
+ api/_handlers/stripe-webhook.ts                ( ~245 LOC)
+ api/_handlers/stripe-portal.ts                 (  ~70 LOC)
+ src/hooks/useSubscription.ts                   ( ~140 LOC)
+ src/components/billing/BillingTab.tsx          ( ~470 LOC)
+ STRIPE-BILLING.md                              (this file)

M api/handler-manifest.ts                        (3 entries added)
M src/pages/Kai.tsx                              (lazy import + tab case + redirect rule)
M src/components/kai/KaiSidebar.tsx              (CreditCard import + nav item)
```

## Validação

- `bun run build` ✅ (chunk `BillingTab-XXX.js` 13.06 kB / 3.93 kB gz)
- `bunx tsc --noEmit` ✅
- Migration aplicada ✅ (4 plans em produção):

```
Free        | R$ 0    | 100 tokens
Starter     | R$ 97   | 1.000 tokens
Pro         | R$ 297  | 5.000 tokens
Enterprise  | R$ 997  | 25.000 tokens
```
