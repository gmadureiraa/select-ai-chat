# SV Schema Fix — Sequência Viral integration with KAI

Trabalho do agente **SV-SCHEMA-FIX** sobre `combo-viral-integration`. Branch
não comitada — review humano antes de subir.

## Contexto

`src/components/kai/viral-sv-original/` contém o standalone Sequência Viral
copiado literal (117 files, 40K LOC). Dois conflitos com o schema KAI Neon
e o billing existente:

1. **Schema mismatch** — `profiles` no KAI Neon não tinha `usage_count`,
   `usage_limit`, `plan`, `period_start`, `referral_code`, `referred_by`.
   Em runtime, o `profile` ficava parcialmente nulo e o `bumpCarouselUsage`
   chamava RPC inexistente (`increment_usage_count`).
2. **Stripe paywall duplicado** — `pages-app/plans.tsx` rendrava 3-cards
   Stripe checkout enquanto KAI já tem `BillingTab` (Free/Starter/Pro/Enterprise).

## Parte 1 — Migration 0008

`migrations/0008_sv_profile_extensions.sql` aplicada via `psql` no Neon
production (sa-east-1). Resultado:

```
ALTER TABLE
DO        -- check constraint sv_plan
DO        -- unique constraint referral_code
CREATE INDEX
CREATE FUNCTION   -- increment_sv_usage(uuid)
CREATE FUNCTION   -- increment_usage_count(uuid)  ← alias legacy
```

Schema final `public.profiles` (campos novos):

| Coluna             | Tipo                         | Default    |
|--------------------|------------------------------|------------|
| `usage_count`      | integer                      | 0          |
| `usage_limit`      | integer                      | 5          |
| `sv_plan`          | text (CHECK in 4 valores)    | `'free'`   |
| `sv_period_start`  | timestamptz                  | `now()`    |
| `referral_code`    | text UNIQUE                  | `null`     |
| `referred_by`      | uuid FK profiles(id)         | `null`     |

Constraints:
- `profiles_sv_plan_check`: `sv_plan IN ('free','starter','pro','enterprise')`
- `profiles_referral_code_key`: UNIQUE
- `profiles_referred_by_fkey`: auto-referencial pra árvore de indicação

Index:
- `idx_profiles_referral` (partial WHERE NOT NULL) — lookup `?ref=` da landing.

RPCs:
- `public.increment_sv_usage(p_user_id uuid) → integer` — bump atômico
  preferido nas integrações novas.
- `public.increment_usage_count(uid uuid) → integer` — alias compat com
  `lib/carousel-storage.ts::bumpCarouselUsage` (não precisamos editar).

Migration é idempotente (`IF NOT EXISTS` em colunas/index, DO blocos pra
constraints). Pode rodar de novo sem efeito colateral.

## Parte 2 — Profile bridge

### `src/components/kai/viral-sv-original/lib/profile-bridge.ts` (novo)

Hook `useSvProfile()` que casa profile + workspace_subscriptions e devolve
o shape `SvProfileShape` esperado pelo SV. Mapeamento de planos:

| KAI plan_type    | SV legacy `plan` | usage_limit padrão |
|------------------|------------------|--------------------|
| `free`/`starter` | `free`           | 5                  |
| `pro`            | `pro`            | 30                 |
| `enterprise`     | `business`       | 9999 (∞)           |

`profiles.usage_limit` override manual supera quota do plano (Gabriel pode
dar bonus). `period_start` vem de `current_period_start` da subscription.

### `lib/auth-context.tsx` — fetchProfile reescrito

Em vez de `select("*")` cru, agora:

1. Lê `profiles` (campos namespaced).
2. Pega `workspace_id` da primeira `workspace_members`.
3. Lê `workspace_subscriptions(*, subscription_plans(type))`.
4. Mapeia pra shape legacy `UserProfile` com `plan`/`usage_limit` corretos.
5. Anexa via cast `period_start`/`referral_code`/`referred_by` que não
   são tipados em `UserProfile` mas são consumidos em runtime.

`AuthProvider` fica intacto — só `fetchProfile` virou um adapter completo.
Não criei dependência cruzada com `useSvProfile()` pra evitar dois
fetches; ambos os caminhos estão disponíveis e usam o mesmo schema.

## Parte 3 — Stripe paywall removal

### `pages-app/plans.tsx` reescrita

De 438 linhas (3-card Stripe checkout) → 110 linhas (card cream + REC
loader). Em mount:

```tsx
useEffect(() => {
  const t = setTimeout(navigateToKaiBilling, 600);
  return () => clearTimeout(t);
}, []);
```

`navigateToKaiBilling()` faz `pushState({ tab: 'billing' })` + dispara
`PopStateEvent('popstate')` pro `useSearchParams` do `Kai.tsx` acordar.
Botão fallback "Ir agora" caso o auto-redirect falhe.

### `shims/next-link.tsx` — interceptor de billing

Toda `<Link href="/app/plans">` ou `<Link href="/app/checkout?...">`
intercepta o click e chama `navigateToKaiBilling()` em vez de navegar.
ctrl/cmd-click ainda permite abrir em nova aba (sem o intercept).

Outras rotas `/app/*` viram hash route (`#/dashboard`, `#/create/abc/edit`).

### `shims/next-navigation.ts` — useRouter().push interceptor

Mesma lógica em `useRouter().push()` / `.replace()` / `redirect()`. Cobre
chamadas programáticas:

- `pages-app/create-id/concepts.tsx::router.push("/app/plans")` ✓
- Email templates com `${appUrl}/app/checkout` (server-side, irrelevante)
- `discount-popup.tsx` e `require-business.tsx` usam `<Link>` — já cobertos.

## Files modificados

```
migrations/0008_sv_profile_extensions.sql                                  +95  (novo)
src/components/kai/viral-sv-original/lib/profile-bridge.ts                 +176 (novo)
src/components/kai/viral-sv-original/lib/auth-context.tsx                  +110 -16
src/components/kai/viral-sv-original/pages-app/plans.tsx                   +110 -437
src/components/kai/viral-sv-original/shims/next-link.tsx                   +97  -25
src/components/kai/viral-sv-original/shims/next-navigation.ts              +35  -2
```

## Build status

- `bun run build` ✓ — 1m 5s, sem erros.
- `bunx tsc --noEmit` ✓ — sem erros nas files tocadas (viral-sv-original/,
  profile-bridge, auth-context, plans, shims).
- Migration 0008 aplicada em produção Neon (sa-east-1, neondb).

## Pontos abertos / future work

1. **Email templates** (`lib/email/templates/plan-limit.tsx`,
   `onboarding-why-upgrade.tsx`, `last-chance-coupon.tsx`) ainda têm
   links absolutos `${appUrl}/app/checkout?plan=pro&coupon=VIRAL50`.
   No KAI integrado isso não faz sentido — sugestão: trocar pra
   `${appUrl}?tab=billing` num passe futuro. Não bloqueia build,
   só afeta emails enviados.
2. **`bumpCarouselUsage` ainda chama `increment_usage_count`** (alias
   criado na migration). Pode evoluir pra `increment_sv_usage` num
   refactor — sem urgência, ambos funcionam.
3. **Referral system** (`referrals.ts`, `referral-client.ts`) agora
   tem schema, mas o backend `/api/referrals/*` não foi auditado pelo
   agente (escopo era só schema + paywall). Pode ter handlers ainda
   referenciando coluna `plan` em vez de `sv_plan`.
4. **`profile.plan` na auth-context** está mapeado, mas qualquer
   `updateProfile({ plan: 'pro' })` direto vai escrever em coluna não
   existente (KAI usa subscription, não `plan` em profiles). Recomendado
   bloquear writes de `plan` no `updateProfile` se isso virar um caminho
   ativo.

## Não fizemos (out of scope)

- Não tocamos em `viral-radar-original/`, `viral-reels-original/`.
- Não tocamos em `api/_handlers/`.
- Não tocamos em `src/components/billing/` (BillingTab existente).
- Não comitamos.
