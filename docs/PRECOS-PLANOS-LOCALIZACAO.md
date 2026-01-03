# 💰 Preços e Planos - Localização no Código

**Objetivo:** Documentar onde estão os preços e planos no código para facilitar alterações.

---

## 📊 PLANOS E PREÇOS ATUAIS

### Starter:
- **Landing Page (USD):** $49/mês
- **Settings (BRL):** R$ 97/mês
- **Banco de Dados (BRL):** R$ 97/mês | R$ 970/ano
- **Stripe (USD):** $49/mês

### Pro:
- **Landing Page (USD):** $249/mês
- **Settings (BRL):** R$ 297/mês
- **Banco de Dados (BRL):** R$ 297/mês | R$ 2.970/ano
- **Stripe (USD):** $249/mês

### Enterprise:
- **Todos:** "Sob consulta"

⚠️ **INCONSISTÊNCIA:** Landing page e Stripe em USD, Settings e DB em BRL

---

## 📍 LOCAIS NO CÓDIGO

### 1. Landing Page (PricingSection.tsx)
**Arquivo:** `src/components/landing/PricingSection.tsx`  
**Linhas:** 8-64

```typescript
const plans = [
  {
    name: "Starter",
    price: "$49",  // ⚠️ USD
    period: "/mês",
    // ...
  },
  {
    name: "Pro",
    price: "$249",  // ⚠️ USD
    period: "/mês",
    // ...
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    // ...
  },
];
```

---

### 2. Settings/Upgrade Dialog (UpgradePlanDialog.tsx)
**Arquivo:** `src/components/settings/UpgradePlanDialog.tsx`  
**Linhas:** 24-84

```typescript
const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 97",  // ⚠️ BRL
    period: "/mês",
    // ...
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 297",  // ⚠️ BRL
    period: "/mês",
    // ...
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sob consulta",
    // ...
  },
];
```

---

### 3. Banco de Dados (Migration)
**Arquivo:** `supabase/migrations/20251224022611_ef569988-070e-4b33-8f70-34b544649397.sql`  
**Linhas:** 78-82

```sql
INSERT INTO subscription_plans (name, type, price_monthly, price_yearly, tokens_monthly, max_clients, max_members, features) VALUES
('Gratuito', 'free', 0, 0, 1000, 2, 1, '["chat_basico", "1_cliente"]'),
('Starter', 'starter', 97, 970, 10000, 5, 3, '["chat_avancado", "automacoes_basicas", "5_clientes"]'),
('Pro', 'pro', 297, 2970, 50000, 20, 10, '["tudo_starter", "automacoes_avancadas", "api_access", "20_clientes"]'),
('Enterprise', 'enterprise', 0, 0, 0, 0, 0, '["ilimitado", "suporte_dedicado", "white_label"]')
ON CONFLICT (type) DO NOTHING;
```

**Valores:**
- Starter: R$ 97/mês | R$ 970/ano
- Pro: R$ 297/mês | R$ 2.970/ano

---

### 4. Stripe (Create Checkout Function)
**Arquivo:** `supabase/functions/create-checkout/index.ts`  
**Linhas:** 11-22

```typescript
const PLANS = {
  starter: {
    priceId: "price_1Si2iLPIJtcImSMvHG6aWpCm", // $49/month USD
    productId: "prod_TfNT7f3WMVagaz",
    trialDays: 14,
  },
  pro: {
    priceId: "price_1Si2iNPIJtcImSMvot2pJbyr", // $249/month USD
    productId: "prod_TfNTm4r0XyYOPB",
    trialDays: 14,
  },
};
```

**Valores:**
- Starter: $49/mês (USD)
- Pro: $249/mês (USD)

---

### 5. Documentation Page
**Arquivo:** `src/pages/Documentation.tsx`  
**Linhas:** 116-123

```typescript
<div className="p-2 rounded bg-background">
  <p className="font-medium">Starter</p>
  <p className="text-muted-foreground">$49/mês • 10k tokens</p>
</div>
<div className="p-2 rounded bg-background">
  <p className="font-medium">Pro</p>
  <p className="text-muted-foreground">$249/mês • 50k tokens</p>
</div>
```

---

## ⚠️ INCONSISTÊNCIAS IDENTIFICADAS

1. **Moeda:** Landing page e Stripe em USD ($), Settings e DB em BRL (R$)
2. **Valores:** 
   - Landing: $49 / $249
   - Settings: R$ 97 / R$ 297
   - DB: R$ 97 / R$ 297
   - Stripe: $49 / $249

**Recomendação:** Padronizar em uma única moeda (sugerido BRL já que DB e Settings estão em BRL).

---

## ✅ CHECKLIST PARA ATUALIZAR PREÇOS

- [ ] `src/components/landing/PricingSection.tsx` - Landing page
- [ ] `src/components/settings/UpgradePlanDialog.tsx` - Settings
- [ ] `supabase/migrations/...sql` - Banco de dados (criar nova migration)
- [ ] `supabase/functions/create-checkout/index.ts` - Stripe (price IDs)
- [ ] `src/pages/Documentation.tsx` - Documentation page
- [ ] Verificar outros lugares que mencionam preços

---

## 📝 NOTAS

- Stripe price IDs precisam ser atualizados no Stripe Dashboard
- Migration do banco precisa ser criada (não editar migrations existentes)
- Verificar se há outros componentes que mostram preços

