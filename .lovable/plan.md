

# Limpeza de Código Duplicado, Não Usado e Vestígios do Sistema de Planos

## Resumo

Encontrei ~30 arquivos/componentes que são vestígios do antigo sistema de planos/billing, duplicatas, ou completamente não usados. Removê-los vai reduzir a complexidade e o tamanho do app significativamente.

## O que será removido

### 1. Sistema de Planos/Billing (desativado, mas ainda presente)
Estes arquivos são vestígios do sistema de monetização que foi desativado. Todos retornam valores fixos ou não são mais referenciados por rotas:

- **`src/lib/plans.ts`** — Config de preços Canvas/Pro/Enterprise. Não é importado por nenhum componente de UI ativo
- **`src/hooks/useTokens.ts`** — Saldo de tokens/billing. Usado apenas por `useTokenError` e `PlanBillingCard`
- **`src/hooks/useTokenError.tsx`** + **`src/components/settings/UpgradePlanDialog.tsx`** — Provider de erro 402 com dialog de upgrade. Pode ser simplificado para apenas logar o erro
- **`src/components/settings/PlanBillingCard.tsx`** — Card de billing. Não é importado por ninguém
- **`src/components/kai/SidebarUpgradeCTA.tsx`** — Retorna `null`. Não é importado
- **`src/hooks/useUpgradePrompt.tsx`** — Provider wrapper que só faz `toast.info()`. Pode ser inlined
- **`src/hooks/usePlanLimits.ts`** — Retorna `Infinity` para tudo. Único uso em `ClientsManagementTool`
- **`src/hooks/usePlanFeatures.ts`** — Retorna `true` para tudo. 5 usos, pode ser inlined
- **`src/components/shared/EnterpriseLockScreen.tsx`** — Lock screen com WhatsApp link. 1 uso
- **Edge Functions de billing**: `create-checkout`, `customer-portal`, `verify-checkout-and-create-workspace` — Stripe checkout flow não mais usado

### 2. Componentes Duplicados
- **`src/components/ConversationHistory.tsx`** vs **`src/components/kai/ConversationHistorySidebar.tsx`** — Dois componentes de histórico de conversa. O primeiro (90 linhas) não é importado por nenhum outro componente ativo
- **`src/components/MessageBubble.tsx`** — Versão antiga, substituída por `EnhancedMessageBubble`. Usado apenas como wrapper do `MessageActions`
- **`src/components/ProtectedRoute.tsx`** — Não é importado por ninguém (substituído por `AuthOnlyRoute` + `WorkspaceRouter`)
- **`src/components/WorkspaceRedirect.tsx`** — Não é importado
- **`src/components/NavLink.tsx`** — Não é importado

### 3. Páginas Não Roteadas
- **`src/pages/LandingPage.tsx`** + todo **`src/components/landing/`** (28 arquivos) — Landing page completa que não está em nenhuma rota do App.tsx
- **`src/pages/Settings.tsx`** — Página standalone que não é roteada (settings agora é uma tab em Kai via `SettingsTab`)
- **`src/pages/CreateWorkspaceCallback.tsx`** — Callback do Stripe checkout, não roteado

### 4. Hooks Não Utilizados
- **`src/hooks/useScheduledPosts.ts`** — Zero imports
- **`src/hooks/useGenerateClientContext.ts`** — Verificar uso (provavelmente substituído pelo edge function)

### 5. Edge Functions Deprecated
- **`supabase/functions/generate-content-from-idea/`** — Já faz redirect para `unified-content-api` com log `[DEPRECATED]`
- **`supabase/functions/chat/`** — Provavelmente substituída por `kai-simple-chat`

## O que será simplificado (não removido)

### Inlining de hooks triviais
- **`usePlanFeatures`** — Em vez de importar um hook que retorna `true` para tudo, remover as condições nos 5 componentes que o usam (já que tudo é sempre `true`)
- **`usePlanLimits`** — Remover a checagem em `ClientsManagementTool` (sempre `canAddClient: true`)
- **`useUpgradePrompt`** — Substituir os 4 usos por `toast.info()` direto e remover o Provider do App.tsx
- **`useTokenError`** — Simplificar para não depender de `useTokens` nem mostrar `UpgradePlanDialog`

## Impacto

- ~40 arquivos removidos (28 landing + 12 vestígios)
- ~3000+ linhas de código eliminadas
- App.tsx simplificado (remove `TokenErrorProvider` e `UpgradePromptProvider`)
- 3 edge functions de billing podem ser removidas
- Zero impacto funcional — tudo que é removido já está inativo ou retorna valores fixos

## Ordem de Execução

1. Remover arquivos não importados (landing, ProtectedRoute, WorkspaceRedirect, NavLink, SidebarUpgradeCTA, PlanBillingCard, ConversationHistory duplicado)
2. Inline `usePlanFeatures` nos 5 componentes e remover hook
3. Inline `useUpgradePrompt` nos 4 componentes e remover Provider do App.tsx
4. Simplificar `useTokenError` (remover dependência de useTokens/UpgradePlanDialog)
5. Remover `usePlanLimits`, `useTokens`, `plans.ts`, `useScheduledPosts`
6. Remover edge functions deprecated (`generate-content-from-idea`, `create-checkout`, `customer-portal`, `verify-checkout-and-create-workspace`)

