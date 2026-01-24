
# Plano: Auditoria e Correção da Experiência Completa do Usuário

## 1. Corrigir Preços Inconsistentes (CRÍTICO)

### CreateWorkspaceDialog.tsx
Atualizar os preços que estão errados:
```typescript
// DE:
const PLANS = {
  basic: { name: "Basic", price: "$25", ... },
  agency: { name: "Agency", price: "$100", ... },
};

// PARA:
const PLANS = {
  basic: { 
    name: "Canvas", 
    price: "$19.90", 
    description: "Para criadores solo",
    features: ["1 perfil", "Canvas ilimitado", "IA multi-agente"] 
  },
  agency: { 
    name: "Pro", 
    price: "$99.90", 
    description: "Suite completa para agências",
    features: ["10 perfis", "5 membros", "Analytics + Biblioteca"] 
  },
};
```

---

## 2. Corrigir Rota /signup (CRÍTICO)

O `/signup` atualmente vai para `CreateFirstWorkspace.tsx` que:
- Cria workspace GRÁTIS sem passar pelo Stripe
- Usa `create_workspace_with_subscription` que bypassa o pagamento

### Solução: Redirecionar /signup para Fluxo com Pagamento

**App.tsx** - Modificar rotas:
```typescript
// Remover CreateFirstWorkspace do /signup
// Manter apenas SimpleSignup + NoWorkspacePage + CreateWorkspaceDialog

<Route path="/signup" element={<SimpleSignup />} />
```

Ou modificar `CreateFirstWorkspace.tsx` para:
1. Criar conta apenas
2. Redirecionar para NoWorkspacePage
3. Lá o usuário clica em "Criar Workspace" que abre CreateWorkspaceDialog (que faz checkout)

---

## 3. Remover/Corrigir CreateFirstWorkspace.tsx (CRÍTICO)

Atualmente essa página:
- Mostra "Plano Canvas - $19.90/mês" mas NÃO COBRA
- Usa RPC `create_workspace_with_subscription` que cria workspace grátis
- Promete "1.000 tokens grátis" sem validar

### Opção A: Converter para Fluxo com Checkout
Modificar para chamar `create-checkout` edge function após criar conta, igual CreateWorkspaceDialog faz.

### Opção B: Remover Página
Remover `/signup` e `/create-workspace` e usar apenas:
- `/register` -> SimpleSignup (cria conta)
- `/no-workspace` -> NoWorkspacePage (mostra opção de criar workspace com checkout)

---

## 4. Sincronizar Planos no Banco de Dados

Atualizar `subscription_plans` para refletir o que prometemos:

```sql
UPDATE subscription_plans 
SET 
  name = 'Canvas',
  max_clients = 1,
  max_members = 1,
  features = '["canvas_ilimitado", "ia_multi_agente", "templates", "1_perfil"]'
WHERE type = 'starter';

UPDATE subscription_plans 
SET 
  name = 'Pro',
  max_clients = 10,
  max_members = 5,
  features = '["tudo_canvas", "planning_kanban", "performance_analytics", "biblioteca", "publicacao_automatica", "integrações"]'
WHERE type = 'pro';
```

---

## 5. Corrigir customer-portal return_url

**supabase/functions/customer-portal/index.ts**

```typescript
// Receber o slug do workspace no body
const { currentSlug } = await req.json().catch(() => ({}));

const origin = req.headers.get("origin") || "https://kai-kaleidos.lovable.app";

// Retornar para o workspace correto
const returnUrl = currentSlug 
  ? `${origin}/${currentSlug}?tab=settings&section=billing`
  : `${origin}/`;

const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: returnUrl,
});
```

---

## 6. Adicionar Trial Period (Opcional)

Se quisermos manter a promessa de "14 dias grátis":

**create-checkout/index.ts**
```typescript
const session = await stripe.checkout.sessions.create({
  // ... outras configs
  subscription_data: {
    trial_period_days: 14, // Adicionar trial
    metadata: { ... }
  },
});
```

OU remover menção de trial do CreateWorkspaceDialog.

---

## 7. Corrigir Textos da Landing Page

### CreateFirstWorkspace.tsx (se mantido)
- Remover "1.000 tokens grátis" (falso)
- Ou implementar lógica real de trial tokens

### CanvasVsProSection.tsx (linha 331)
- Corrigir número de WhatsApp para o correto

---

## 8. Mapear Planos Corretamente

Criar constante centralizada para evitar inconsistências:

**src/lib/plans.ts**
```typescript
export const PLANS = {
  canvas: {
    name: "Canvas",
    price: 19.90,
    priceId: "price_1SpuAmPIJtcImSMvb7h2pxYa",
    productId: "prod_TnVBYALwIy8qOm",
    dbType: "starter", // tipo no banco
    maxClients: 1,
    maxMembers: 1,
    features: ["Canvas ilimitado", "IA multi-agente", "1 perfil"]
  },
  pro: {
    name: "Pro",
    price: 99.90,
    priceId: "price_1SpuAoPIJtcImSMvLMPO5XUo",
    productId: "prod_TnVBIbisvWihL7",
    dbType: "pro",
    maxClients: 10,
    maxMembers: 5,
    features: ["Tudo do Canvas", "3 perfis (+$7/extra)", "3 membros (+$4/extra)", ...]
  }
} as const;
```

---

## 9. Verificar Cancelamento de Plano

O cancelamento funciona via customer-portal do Stripe, mas precisamos:

1. Atualizar `PlanBillingCard.tsx` para passar o slug correto
2. Testar se o cancelamento atualiza `workspace_subscriptions.status`
3. Implementar webhook se necessário (atualmente não parece ter)

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `CreateWorkspaceDialog.tsx` | Corrigir preços $25->$19.90, $100->$99.90 |
| `CreateFirstWorkspace.tsx` | Remover ou converter para checkout obrigatório |
| `App.tsx` | Ajustar rotas /signup |
| `customer-portal/index.ts` | Aceitar slug e retornar URL correta |
| `PlanBillingCard.tsx` | Passar slug ao chamar customer-portal |
| `CanvasVsProSection.tsx` | Corrigir WhatsApp |
| **SQL Migration** | Atualizar subscription_plans com limites corretos |
| `src/lib/plans.ts` | NOVO - Constantes centralizadas de planos |

---

## Ordem de Execução

1. **SQL**: Atualizar subscription_plans
2. **CreateWorkspaceDialog**: Corrigir preços
3. **CreateFirstWorkspace**: Decidir - remover ou integrar checkout
4. **customer-portal**: Corrigir return_url
5. **Criar plans.ts**: Centralizar constantes
6. **Testar fluxo completo**: Landing -> Signup -> Checkout -> Workspace
7. **Testar cancelamento**: Settings -> Manage Subscription -> Cancel
