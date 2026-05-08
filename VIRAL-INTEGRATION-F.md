# VIRAL-INTEGRATION-F — Permissões e Plan Enforcement

**Data:** 2026-05-08
**Branch:** `combo-viral-integration` (não commitado)
**Fase:** F — Permissões + Plan Enforcement

## Objetivo

Amarrar os 3 viral apps (Sequência, Reels, Radar) ao sistema de planos da KAI:
- Bloqueio de feature por plano (`viral_carousel`, `viral_reels`, `viral_radar` flags)
- Bloqueio por role (viewer não cria, só lê)
- Limite mensal de tokens (consumo por operação)
- Limite de clientes (`max_clients` do plano)

## Arquivos criados/modificados

### Migrations
- **`migrations/0013_workspace_tokens_init.sql`** (novo, aplicado no Neon)
  - Adiciona coluna `monthly_quota` em `workspace_tokens` (cache do plano)
  - Backfill de monthly_quota a partir do plano vigente
  - Cria registros pra workspaces sem entrada
  - Função `debit_tokens(workspace_id, amount, reason)` → jsonb com `{ok, remaining, balance}`
    - Reset automático de `tokens_used_this_period` quando `period_end < now()`
    - Lock atômico (FOR UPDATE) no debit
    - Log em `token_transactions` com type='usage'
  - Função `check_tokens(workspace_id)` → jsonb com `{remaining, used, quota, balance}`

### Hooks
- **`src/hooks/useViralAccess.ts`** (novo)
  - Hook composto que consulta `workspace_subscriptions`, `workspace_members`, `workspace_tokens` e count de `clients`
  - Retorna `ViralAccess` com flags `canUseSequencia`, `canUseReels`, `canUseRadar`, `tokensRemaining`, `clientsRemaining`, role helpers etc
  - Exporta `VIRAL_TOKEN_COSTS` (carousel: 50, reel: 20, brief: 10, image: 5)

### Components
- **`src/components/kai/viral/UpgradePrompt.tsx`** (novo)
  - Card de upgrade com 5 variants: `viral_carousel`, `viral_reels`, `viral_radar`, `tokens`, `clients`
  - Trata `reason='role_viewer'` separadamente (mensagem específica)
  - Botão "Ver planos" navega pra `?tab=billing`
- **`src/components/kai/viral/TokensRemainingBadge.tsx`** (novo)
  - Badge mostrando `X/Y` ou label verbose
  - Variant adapta: `secondary` (>20%), `outline` (<20%), `destructive` (esgotado)
- **`src/components/kai/viral/ViralFeatureGate.tsx`** (novo)
  - Wrapper que checa `useViralAccess()` e renderiza `UpgradePrompt` quando bloqueado
  - 3 features: `sequencia`, `reels`, `radar`

### Backend
- **`api/_lib/shared/tokens.ts`** (modificado)
  - Adicionado `VIRAL_TOKEN_COSTS` (espelha hook UI)
  - Nova função `checkTokens(workspaceId, amount)` → `{ok, remaining, needed?}`
  - Nova função `debitTokens(workspaceId, amount, reason)` → `{ok, remaining}`
  - Helper `ensureTokens()` que lança `InsufficientTokensError` se insuficiente
  - **Preserva** `checkWorkspaceTokens` e `debitWorkspaceTokens` originais (compat)

### Handlers (token enforcement integrado)
- **`api/_handlers/generate-viral-carousel.ts`**
  - Token check após resolver `client.workspace_id` (cron/internal não pagam)
  - Resposta 402 `TOKENS_EXHAUSTED` quando insuficiente
  - Debit de 50 tokens (`VIRAL_TOKEN_COSTS.carousel`) após sucesso do Gemini, antes de persist
- **`api/_handlers/adapt-viral-reel.ts`**
  - Token check após resolver `client.workspace_id`
  - Lança erro `TOKENS_EXHAUSTED` (status 402, code) quando insuficiente
  - Debit de 20 tokens (`VIRAL_TOKEN_COSTS.reel`) após Gemini retornar
- **`api/_handlers/kai-content-agent.ts`**
  - Resolve `workspaceId` via body OR clients lookup
  - Token check com `isInternalCall` flag
  - Debit de 10 tokens (`VIRAL_TOKEN_COSTS.brief`) em ambos os paths (streaming + non-streaming)

### Pages
- **`src/pages/Kai.tsx`** (modificado)
  - `ViralFeatureGate` lazy-imported
  - Cases `viral-carrossel`, `viral-reels-page`, `viral-radar-page` envoltos com `<ViralFeatureGate feature="...">`
  - Mantém `ClientRequiredEmpty` quando não tem cliente selecionado

## Schema observations

A tabela `workspace_tokens` tem schema diferente do plano original:
- `tokens_used_this_period` (não `used_this_month`)
- `period_start` / `period_end` (não `reset_at`)
- O `tokens_used_this_period` é o contador mensal canônico, e `period_end` é quando reseta

A migration 0013 adapta usando os nomes existentes, e a função SQL `debit_tokens` faz o rollover automático quando `period_end < now()` (reseta `tokens_used_this_period=0` e zera `balance` pro `monthly_quota`).

`token_transactions.type` é enum `token_transaction_type` (`usage`, `purchase`, `refund`, `bonus`, `adjustment`, `subscription_credit`). Usamos `'usage'` no debit.

## Validação

### Migration
```bash
PSQL=/opt/homebrew/opt/libpq/bin/psql
NEON_URL="postgresql://neondb_owner:npg_HKMtF01ADqwP@ep-sparkling-moon-acbufmuw-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$PSQL "$NEON_URL" -f migrations/0013_workspace_tokens_init.sql
# ALTER TABLE / UPDATE 0 / INSERT 0 1 / CREATE FUNCTION / GRANT (x2)
```

### End-to-end SQL test
```sql
SELECT public.check_tokens('11111111-1111-1111-1111-111111111111') AS result;
-- {"used": 0, "quota": 100, "balance": 100, "remaining": 100}

SELECT public.debit_tokens('11111111-1111-1111-1111-111111111111', 5, 'test-debit') AS result;
-- {"ok": true, "balance": 95, "remaining": 95}
```

### Build
```bash
bun run build
# ✓ built in 7.75s — sem erros TS no código novo
```

Erros TS pré-existentes ficam em `viral-sv-original/`, `viral-radar-original/`, `viral-reels-original/` e `*.legacy.tsx` (cópia literal dos apps standalone, fora do escopo desta fase).

## Como testar manualmente

1. **Abrir tab viral em workspace Free:**
   - Free tem `viral_carousel: false` no plano → renderiza `<UpgradePrompt feature="viral_carousel">`
2. **Workspace Starter (carousel + reels true, radar false):**
   - Tab Carrossel funciona, Tab Radar mostra UpgradePrompt pro Pro
3. **Workspace Pro:**
   - Tudo liberado. Após gerar 2 carrosséis (50 tokens cada), saldo cai pra ~4900/5000
4. **User com role=viewer:**
   - Mesmo em Pro, vê UpgradePrompt com `reason="role_viewer"` (mensagem "peça pro admin")
5. **Esgotar tokens (forçar):**
   ```sql
   UPDATE workspace_tokens SET tokens_used_this_period=monthly_quota, balance=0 WHERE workspace_id='<id>';
   ```
   - Próximo `POST /api/generate-viral-carousel` retorna 402 com `error: "TOKENS_EXHAUSTED"`

## TokensRemainingBadge — onde plugar

Ainda **não pluguei** o badge no header. Sugestão de local:
- `src/components/kai/MobileHeader.tsx` (header do KAI no mobile)
- `src/components/kai/KaiSidebar.tsx` (sidebar topo, ao lado do nome do workspace)

Como FRONTEND-AGENT mexe em `ClientContextHeader.tsx` em paralelo, deixei pra plugar manualmente depois pra evitar conflito. Exemplo de uso:

```tsx
import { TokensRemainingBadge } from "@/components/kai/viral/TokensRemainingBadge";

<div className="flex items-center gap-2">
  <span>Workspace: {workspace.name}</span>
  <TokensRemainingBadge />
</div>
```

## Caveats / TODOs futuros

1. **`useTokenCost` UI helper:** não criado (o `VIRAL_TOKEN_COSTS` já dá o número direto). Pra mostrar custo no botão Gerar:
   ```tsx
   import { VIRAL_TOKEN_COSTS } from "@/hooks/useViralAccess";
   <Button>Gerar carrossel <span className="text-xs ml-2 opacity-60">— {VIRAL_TOKEN_COSTS.carousel} tokens</span></Button>
   ```
2. **Image generation cost:** `VIRAL_TOKEN_COSTS.image = 5` está disponível mas o handler de imagem (Imagen) não está dentro dos 3 modificados. Aplicar quando integrar.
3. **Reset job:** rollover acontece no primeiro `debit_tokens()` após `period_end`. Se tiver workspace inativo por meses, o saldo só reseta na próxima request. Pra reset proativo no dia 1, precisaria de um cron — fora de escopo dessa fase.
4. **Conflito potencial:** se outro agente (BACKEND) editar os 3 handlers, fazer merge: token check vai no início (após resolução de workspace_id), debit vai no sucesso (após Gemini retornar).

## Status

- [x] Migration 0013 aplicada no Neon
- [x] `useViralAccess` hook
- [x] `UpgradePrompt`, `TokensRemainingBadge`, `ViralFeatureGate` components
- [x] `tokens.ts` com `checkTokens`, `debitTokens`, `ensureTokens`, `VIRAL_TOKEN_COSTS`
- [x] 3 handlers principais com token check + debit (failsoft)
- [x] `Kai.tsx` envolvendo viral tabs com `ViralFeatureGate`
- [x] `bun run build` passa
- [ ] Plug `TokensRemainingBadge` no header (deixado pra integração com FRONTEND)
- [ ] UI helper `useTokenCost` no botão Gerar (pendente, não bloqueia)
