# Plano: Transformar kAI em Sistema Interno da Kaleidos

## Status: ✅ CONCLUÍDO

---

## Resumo das Mudanças Implementadas

### Fase 1: Mudança de Rota Inicial ✅
- **src/App.tsx**: Rota "/" agora redireciona para "/kaleidos" em vez de mostrar LandingPage
- **src/pages/Help.tsx**: Removidos links para "/#pricing", atualizado footer

### Fase 2: Simplificar Sistema de Permissões ✅
- **src/hooks/usePlanFeatures.ts**: Sempre retorna acesso total (isPro: true, isCanvas: false)
- **src/hooks/usePlanLimits.ts**: Sempre retorna limites ilimitados (Infinity)

### Fase 3: Remover UI de Upgrade/Assinatura ✅
- **src/hooks/useUpgradePrompt.tsx**: Desativado - agora exibe toast de permissão
- **src/components/settings/PlanBillingCard.tsx**: Simplificado para "Plano Interno"
- **src/components/kai/SidebarUpgradeCTA.tsx**: Desativado (retorna null)
- **src/components/kai/KaiSidebar.tsx**: Removida lógica de Canvas/Pro, bloqueio por role
- **src/components/kai-global/GlobalKAIAssistant.tsx**: Bloqueio baseado em role

### Fase 4-5: Desativar Checkout e WorkspaceSwitcher ✅
- **src/components/kai/WorkspaceSwitcher.tsx**: Removida opção de criar workspace

---

## Novo Modelo de Permissões

| Role | Canvas/Chat | Planejamento | Performance | Biblioteca | Perfis | Gerenciar Equipe |
|------|-------------|--------------|-------------|------------|--------|------------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Member** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Viewer** | 🔒 | Read-only | Read-only | Read-only | 🔒 | ❌ |

---

## Arquivos Mantidos (Desativados)

- `src/pages/LandingPage.tsx` - Pode ser útil no futuro
- `src/components/landing/*` - 28 componentes de landing
- `src/lib/plans.ts` - Referência de configuração
- `supabase/functions/create-checkout/` - Edge function de pagamento
- `supabase/functions/customer-portal/` - Portal Stripe
- Tabelas de subscription no banco - Evitar quebrar queries

---

## Checklist de Validação

- [x] "/" redireciona para /kaleidos
- [x] Admin vê todas as áreas sem locks
- [x] Member vê todas as áreas sem locks
- [x] Viewer vê Planning/Performance/Biblioteca em read-only
- [x] Viewer não consegue acessar Canvas/kAI Chat (mensagem de permissão)
- [x] Não há botões de "Upgrade" ou "Fazer Upgrade" visíveis
- [x] Settings > Plano mostra "Plano Interno" sem opções de pagamento
- [x] WorkspaceSwitcher não tem opção de criar workspace
