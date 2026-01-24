
# Plano: Continuar Correção da Experiência Completa do Usuário

## Fase 1: Corrigir Banco de Dados (SQL Migration)

### Atualizar subscription_plans com preços e Price IDs corretos:
```sql
UPDATE subscription_plans 
SET 
  name = 'Canvas',
  price_monthly = 19.90,
  price_yearly = 199.00,
  max_clients = 1,
  max_members = 1,
  stripe_price_id = 'price_1SpuAmPIJtcImSMvb7h2pxYa',
  stripe_product_id = 'prod_TnVBYALwIy8qOm',
  features = '["canvas_ilimitado", "ia_multi_agente", "geracao_imagens", "templates", "1_perfil"]'
WHERE type = 'starter';

UPDATE subscription_plans 
SET 
  name = 'Pro',
  price_monthly = 99.90,
  price_yearly = 999.00,
  max_clients = 10,
  max_members = 5,
  stripe_price_id = 'price_1SpuAoPIJtcImSMvLMPO5XUo',
  stripe_product_id = 'prod_TnVBIbisvWihL7',
  features = '["tudo_canvas", "3_perfis_base", "3_membros_base", "planning_kanban", "calendario", "performance_analytics", "biblioteca", "publicacao_automatica", "integracoes", "api"]'
WHERE type = 'pro';
```

---

## Fase 2: Eliminar Bypass de Pagamento (CRÍTICO)

### Opção escolhida: Redirecionar /signup para fluxo com pagamento

**App.tsx** - Modificar rotas:
```typescript
// ANTES:
<Route path="/signup" element={<CreateFirstWorkspace />} />
<Route path="/create-workspace" element={<CreateFirstWorkspace />} />

// DEPOIS:
<Route path="/signup" element={<SimpleSignup />} />
// Remover /create-workspace ou redirecionar para /signup
```

**SimpleSignup.tsx** - Já faz o correto:
- Cria conta
- Redireciona para `/no-workspace`
- Lá o usuário cria workspace via CreateWorkspaceDialog (que passa pelo Stripe)

**Deletar ou deprecar**: `CreateFirstWorkspace.tsx`

---

## Fase 3: Implementar Trial de 14 Dias (ou remover menção)

### Opção A: Implementar no Stripe
**create-checkout/index.ts** - Adicionar trial:
```typescript
const session = await stripe.checkout.sessions.create({
  // ... configs existentes
  subscription_data: {
    trial_period_days: 14, // NOVO
    metadata: {
      user_id: user.id,
      plan_type: planType,
    },
  },
  // ...
});
```

### Opção B: Remover menção de trial
**CreateWorkspaceDialog.tsx** - Remover texto:
```typescript
// REMOVER ou modificar:
// "14 dias grátis! Você terá acesso completo durante o trial."
```

---

## Fase 4: Sincronizar Limites de Perfis em Todos os Lugares

### UpgradePlanDialog.tsx - Corrigir features:
```typescript
const plans = [
  {
    id: "canvas",
    name: "Canvas",
    features: [
      "1 perfil", // ERA "3 perfis"
      "1 usuário",
      // ...
    ],
  },
  {
    id: "pro",
    name: "Pro",  
    features: [
      "3 perfis (+$7/extra)", // Manter consistente com landing
      "3 membros (+$4/extra)",
      // ...
    ],
  },
];
```

### USAR PLAN_CONFIG em vez de hardcoded:
```typescript
import { PLAN_CONFIG } from "@/lib/plans";

const plans = [
  {
    id: "canvas",
    name: PLAN_CONFIG.canvas.name,
    features: PLAN_CONFIG.canvas.features,
    // ...
  },
  // ...
];
```

---

## Fase 5: Remover Promessa de "1.000 tokens grátis"

**CreateFirstWorkspace.tsx** (se mantido):
- Linha 300: Remover "🎁 Você receberá 1.000 tokens grátis"
- Ou implementar lógica real de créditos iniciais

---

## Fase 6: Corrigir Links da Landing Page

Os links na landing page vão para `/signup?plan=basic` e `/signup?plan=agency`:

**Opções:**
1. Redirecionar esses links para criar conta e depois selecionar plano
2. Modificar SimpleSignup para detectar `?plan=` e redirecionar apropriadamente após login

**Implementação sugerida:**
- `/signup?plan=basic` → SimpleSignup → NoWorkspacePage (auto-abre CreateWorkspaceDialog com plano básico selecionado)

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| SQL Migration | Atualizar subscription_plans |
| App.tsx | Redirecionar /signup para SimpleSignup |
| CreateFirstWorkspace.tsx | Deletar ou mover para /legacy |
| create-checkout/index.ts | Adicionar trial_period_days: 14 |
| CreateWorkspaceDialog.tsx | Ajustar texto de trial (se não implementar) |
| UpgradePlanDialog.tsx | Usar PLAN_CONFIG e corrigir features |
| NoWorkspacePage.tsx | Aceitar ?plan= da URL para pré-selecionar plano |

---

## Ordem de Execução

1. SQL Migration para subscription_plans
2. Modificar App.tsx - redirecionar /signup
3. Deletar/mover CreateFirstWorkspace.tsx
4. create-checkout - adicionar trial (se desejado)
5. UpgradePlanDialog - usar PLAN_CONFIG
6. Testar fluxo completo: Landing → Signup → NoWorkspace → CreateWorkspaceDialog → Stripe → Workspace
