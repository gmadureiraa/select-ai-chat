# 💰 Tokens & Billing
> Última atualização: 09 de Março de 2026

## Visão Geral

O sistema de monetização é baseado em **tokens de IA** consumidos por chamada. Cada workspace possui um saldo de tokens que é debitado automaticamente a cada uso de IA. Os planos são gerenciados via Stripe com checkout e portal do cliente.

---

## 📊 Modelo de Tokens

### Como Funciona
```
Usuário faz chamada de IA (chat, geração, análise)
  → Edge function calcula tokens usados
  → Chama debit_workspace_tokens(workspace_id, amount)
  → Debita saldo → Registra transação
  → Se saldo insuficiente → Retorna erro "Insufficient tokens"
```

### Tabela `workspace_tokens`
```sql
{
  id, workspace_id (unique),
  balance: integer,                  -- Saldo atual de tokens
  tokens_used_this_period: integer,  -- Consumo no período atual
  period_start: timestamp,
  period_end: timestamp,
  created_at, updated_at
}
```

### Tabela `token_transactions`
```sql
{
  id, workspace_id, user_id,
  type: token_transaction_type,  -- usage, subscription_credit, bonus, refund
  amount: integer,               -- Negativo para débito, positivo para crédito
  balance_after: integer,        -- Saldo após transação
  description: text,
  metadata: jsonb,               -- { edge_function, model, tokens_input, tokens_output }
  created_at
}
```

### Função DB `debit_workspace_tokens()`
```sql
-- Parâmetros:
--   p_workspace_id, p_amount, p_user_id, p_description, p_metadata
-- Retorna: { success, new_balance, error }
-- Security: SECURITY DEFINER, verifica membership do workspace
-- Atomicidade: SELECT FOR UPDATE para evitar race conditions
```

---

## 📋 Planos de Assinatura

### Tabela `subscription_plans`
```sql
{
  id, name, type: plan_type,     -- free, starter, pro, enterprise
  price_monthly: decimal,
  price_yearly: decimal,
  tokens_monthly: integer,       -- Crédito mensal de tokens (0 = ilimitado)
  max_clients: integer,
  max_members: integer,
  features: jsonb,               -- Array de features habilitadas
  stripe_product_id,
  stripe_price_id,
  trial_days: integer,
  is_active: boolean
}
```

### Tipos de Plano

| Plano | Tokens/mês | Clientes | Membros | Preço |
|-------|-----------|----------|---------|-------|
| **Free** | Limitado | 1 | 1 | R$ 0 |
| **Starter** | Moderado | 3 | 2 | Variável |
| **Pro** | Alto | 10 | 5 | Variável |
| **Enterprise** | Ilimitado (0) | Ilimitado | Ilimitado | Custom |

> Enterprise: `tokens_monthly = 0` é tratado como ilimitado no código (`isUnlimited`)

### Tabela `workspace_subscriptions`
```sql
{
  id, workspace_id (unique), plan_id,
  status: subscription_status,      -- active, canceled, past_due, trialing
  stripe_customer_id,
  stripe_subscription_id,
  current_period_start,
  current_period_end,
  created_at, updated_at
}
```

---

## 💳 Stripe Integration

### Edge Functions

| Função | Descrição |
|--------|-----------|
| `create-checkout` | Cria sessão Stripe Checkout para upgrade |
| `customer-portal` | Abre portal do cliente para gerenciar assinatura |
| `verify-checkout-and-create-workspace` | Webhook pós-checkout: cria workspace com plano pago |

### Fluxo de Upgrade
```
Usuário clica "Upgrade"
  → create-checkout (Edge Function)
  → Stripe Checkout Session
  → Usuário paga no Stripe
  → Webhook Stripe → verify-checkout-and-create-workspace
  → Atualiza workspace_subscriptions
  → Credita tokens do novo plano
  → Atualiza workspace_tokens.balance
```

### Renovação Mensal
```
Stripe webhook (invoice.paid)
  → Credita tokens_monthly do plano
  → Reseta tokens_used_this_period
  → Atualiza period_start / period_end
```

---

## 🔧 Hook `useTokens()`

```typescript
const {
  balance,               // Saldo atual
  tokensUsedThisPeriod, // Consumo no período
  periodEnd,            // Data fim do período
  transactions,         // Histórico de transações (últimas 50)
  plan,                 // Plano atual { name, type, tokens_monthly, max_clients, ... }
  isLoading,
  hasTokens(amount),    // Verifica se tem saldo suficiente
  formattedBalance,     // Balance formatado (pt-BR)
  isUnlimited,          // true para Enterprise
} = useTokens();
```

---

## 📊 Tracking de Uso (ai_usage_logs)

Cada chamada de IA é registrada para analytics:
```sql
{
  id, user_id, client_id,
  edge_function: text,       -- kai-simple-chat, unified-content-api, etc.
  model_name: text,          -- gemini-2.5-flash, gpt-5-mini, etc.
  provider: text,            -- google, openai
  input_tokens, output_tokens, total_tokens,
  estimated_cost_usd: decimal,
  format_type: text,         -- tweet, linkedin, carousel, etc.
  validation_passed: boolean,
  was_repaired: boolean,
  metadata: jsonb
}
```

### Visibilidade
- Usuários veem próprio consumo
- Admins/Owners veem consumo de todos os membros
- Função `can_view_workspace_ai_usage()` controla acesso
- Super admins: `get_workspace_member_tokens_admin()` para visão global

---

## 🔒 Segurança

- `debit_workspace_tokens` é `SECURITY DEFINER` com verificação de membership
- `SELECT FOR UPDATE` previne race conditions em débitos concorrentes
- Stripe webhooks validados com signature verification
- Chaves Stripe armazenadas como secrets (nunca no código)

---

## 🏗️ Criação de Workspace

Função `create_workspace_with_subscription()`:
1. Cria workspace com slug único
2. Adiciona owner como membro (role: 'owner')
3. Busca plano free padrão
4. Cria `workspace_subscriptions` com período de 30 dias
5. Cria `workspace_tokens` com crédito inicial
6. Registra transação de crédito inicial

---

*Última atualização: Março 2026*
