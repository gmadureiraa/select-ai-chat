
# Plano: Transformar kAI em Sistema Interno da Kaleidos

## Resumo Executivo

Transformar o kAI de um SaaS multi-tenant com planos pagos (Canvas/Pro/Enterprise) para um sistema interno da Kaleidos, removendo toda a camada de assinatura e simplificando para um modelo baseado apenas em roles de usuário.

**Estado atual:**
- 2 workspaces no banco (Kaleidos + Agência)
- Sistema de planos Canvas/Pro/Enterprise com Stripe
- Landing page de venda pública
- Múltiplos gates de features baseados em plano

**Estado desejado:**
- 1 workspace único (Kaleidos)
- Sem sistema de planos/assinaturas
- Login direto para o app (sem landing page)
- Permissões baseadas apenas em roles (admin/member/viewer)

---

## Fase 1: Mudança de Rota Inicial (Baixo Risco)

### 1.1 Redirecionar "/" para o app em vez da Landing Page

**Arquivo:** `src/App.tsx`

**Mudança:**
```text
ANTES:
  <Route path="/" element={<LandingPage />} />

DEPOIS:
  <Route path="/" element={<Navigate to="/kaleidos" replace />} />
```

A LandingPage.tsx NÃO será deletada, apenas desativada do roteamento para uso futuro.

### 1.2 Remover links para landing/pricing no Help

**Arquivo:** `src/pages/Help.tsx`
- Remover links para "/#pricing"
- Manter apenas links úteis internos

---

## Fase 2: Simplificar Sistema de Permissões (Médio Risco)

### 2.1 Atualizar `usePlanFeatures.ts` para sempre retornar acesso total

**Arquivo:** `src/hooks/usePlanFeatures.ts`

**Mudança:** Remover lógica de planos e sempre retornar:
```typescript
return {
  isEnterprise: true,
  isPro: true,
  isCanvas: false,
  hasPlanning: true,
  hasCalendar: true,
  hasKanban: true,
  hasSocialPublishing: true,
  canAccessProfiles: true,
  canAccessPerformance: true,
  canAccessLibrary: true,
  canAccessKaiChat: true,
  canCreateProfiles: true,
  planType: 'internal',
  isLoading: false,
};
```

### 2.2 Atualizar `usePlanLimits.ts` para remover limites

**Arquivo:** `src/hooks/usePlanLimits.ts`

**Mudança:** Sempre retornar limites infinitos:
```typescript
return {
  maxClients: Infinity,
  maxMembers: Infinity,
  currentClients,
  currentMembers,
  pendingInvites,
  canAddClient: true, // Baseado apenas em role
  canAddMember: true, // Baseado apenas em role
  clientsRemaining: Infinity,
  membersRemaining: Infinity,
  isLoading: false,
  isUnlimitedClients: true,
  isUnlimitedMembers: true,
  isCanvas: false,
  isPro: true,
};
```

### 2.3 Atualizar `useWorkspace.ts` para reforçar permissões por role

**Arquivo:** `src/hooks/useWorkspace.ts`

As permissões já estão bem definidas:
- **owner/admin**: Acesso total (canDelete, canManageTeam, canManageAutomations)
- **member**: Pode criar/editar tudo, mas não deletar clientes ou gerenciar equipe
- **viewer**: Apenas visualização de Planning, Performance, Biblioteca

**Ajuste necessário:** Adicionar verificação de `canUseAssistant` para viewer:
```typescript
// Viewer NÃO pode usar áreas de criação (Canvas, kAI Chat)
const canUseAssistant = !isViewer && userRole !== undefined;
const canUseCanvas = !isViewer && userRole !== undefined;
```

---

## Fase 3: Remover UI de Upgrade/Assinatura (Médio Risco)

### 3.1 Desativar `UpgradePromptProvider`

**Arquivo:** `src/hooks/useUpgradePrompt.tsx`

**Mudança:** O `showUpgradePrompt` passa a não fazer nada (ou mostrar mensagem "Fale com o admin"):
```typescript
const showUpgradePrompt = useCallback(() => {
  // Sistema interno - não há upgrade
  toast.info("Entre em contato com o administrador para solicitar acesso.");
}, []);
```

### 3.2 Remover componentes de billing da UI

**Arquivos a modificar:**
- `src/components/settings/PlanBillingCard.tsx` - Simplificar para mostrar "Plano Interno" sem botões de upgrade
- `src/components/settings/UpgradePlanDialog.tsx` - Pode ser desativado (não deletar)
- `src/components/kai/SidebarUpgradeCTA.tsx` - Remover do render

### 3.3 Simplificar sidebar locks

**Arquivo:** `src/components/kai/KaiSidebar.tsx`

**Mudança:** Remover toda lógica de `isCanvas` e `showUpgradePrompt`:
- Planejamento: Visível para todos (viewer em read-only)
- Performance: Visível para todos
- Biblioteca: Visível para todos
- kAI Chat: Visível para member/admin (bloqueado para viewer com mensagem diferente)
- Perfis: Visível para member/admin

### 3.4 Atualizar bloqueio para Viewer

**Novo comportamento para Viewer:**
Em vez de "Disponível no Pro", mostrar "Você não tem permissão para esta área"

**Arquivos afetados:**
- `src/components/kai-global/GlobalKAIAssistant.tsx`
- `src/components/kai/canvas/nodes/ContentOutputNode.tsx`
- Outros componentes que usam `showUpgradePrompt`

---

## Fase 4: Desativar Edge Functions de Pagamento (Baixo Risco)

### 4.1 Manter mas não usar

**Funções a MANTER (não deletar, apenas não usar):**
- `supabase/functions/create-checkout/`
- `supabase/functions/customer-portal/`
- `supabase/functions/verify-checkout-and-create-workspace/`

### 4.2 Remover chamadas no frontend

**Arquivos a modificar:**
- `src/components/workspace/CreateWorkspaceDialog.tsx` - Desativar ou ocultar
- `src/components/settings/PlanBillingCard.tsx` - Remover botão "Gerenciar Assinatura"
- `src/components/settings/UpgradePlanDialog.tsx` - Não renderizar

---

## Fase 5: Simplificar WorkspaceSwitcher (Baixo Risco)

### 5.1 Remover opção de criar novo workspace

**Arquivo:** `src/components/kai/WorkspaceSwitcher.tsx`

**Mudança:** Remover botão "Criar novo workspace" - agora só existe Kaleidos

### 5.2 Ocultar switcher se só há 1 workspace

O código já faz isso, apenas garantir que funcione.

---

## Fase 6: Limpeza de Banco de Dados (Futuro/Opcional)

### 6.1 Dados a manter

- Tabela `subscription_plans` - manter para não quebrar queries
- Tabela `workspace_subscriptions` - manter com status "active" para Kaleidos
- Tabela `workspace_tokens` - pode ser útil para controle futuro de uso

### 6.2 Workspace a remover (manual)

O workspace "Agência Digital" (slug: agencia) pode ser removido manualmente pelo admin quando quiser.

---

## Resumo de Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/App.tsx` | Mudar rota "/" para redirect |
| `src/hooks/usePlanFeatures.ts` | Simplificar para sempre retornar acesso total |
| `src/hooks/usePlanLimits.ts` | Remover limites de plano |
| `src/hooks/useUpgradePrompt.tsx` | Desativar prompts de upgrade |
| `src/components/kai/KaiSidebar.tsx` | Remover lógica de Canvas/Pro |
| `src/components/settings/PlanBillingCard.tsx` | Simplificar para "Plano Interno" |
| `src/components/kai/SidebarUpgradeCTA.tsx` | Remover do render |
| `src/components/kai/WorkspaceSwitcher.tsx` | Remover criar workspace |
| `src/components/kai-global/GlobalKAIAssistant.tsx` | Ajustar bloqueio de viewer |
| `src/pages/Help.tsx` | Remover links de pricing |

---

## Arquivos NÃO Deletados (Desativados)

| Arquivo/Pasta | Razão para manter |
|---------------|-------------------|
| `src/pages/LandingPage.tsx` | Pode ser útil no futuro |
| `src/components/landing/*` | 28 componentes de landing |
| `src/lib/plans.ts` | Referência de configuração |
| `supabase/functions/create-checkout/` | Pode precisar no futuro |
| `supabase/functions/customer-portal/` | Pode precisar no futuro |
| Tabelas de subscription no banco | Evitar quebrar queries |

---

## Novo Modelo de Permissões (Resumo)

| Role | Canvas/Chat | Planejamento | Performance | Biblioteca | Perfis | Gerenciar Equipe |
|------|-------------|--------------|-------------|------------|--------|------------------|
| **Admin** | Sim | Sim | Sim | Sim | Sim | Sim |
| **Member** | Sim | Sim | Sim | Sim | Sim | Não |
| **Viewer** | Bloqueado | Read-only | Read-only | Read-only | Bloqueado | Não |

---

## Ordem de Execução

1. **Fase 1** - Rota inicial (5 min) - Impacto visual imediato
2. **Fase 2** - Permissões (15 min) - Core da mudança
3. **Fase 3** - UI de upgrade (20 min) - Limpeza visual
4. **Fase 4** - Edge functions (5 min) - Apenas frontend
5. **Fase 5** - WorkspaceSwitcher (5 min) - Polimento

**Tempo estimado total:** ~50 minutos

---

## Checklist de Validação

Após implementar, validar:

- [ ] "/" redireciona para /kaleidos
- [ ] Admin vê todas as áreas sem locks
- [ ] Member vê todas as áreas sem locks
- [ ] Viewer vê Planning/Performance/Biblioteca em read-only
- [ ] Viewer não consegue acessar Canvas/kAI Chat (mensagem de permissão, não upgrade)
- [ ] Não há botões de "Upgrade" ou "Fazer Upgrade" visíveis
- [ ] Settings > Plano mostra "Plano Interno" sem opções de pagamento
- [ ] WorkspaceSwitcher não tem opção de criar workspace
