
# Plano: Finalizar Transformação kAI → Sistema Interno Kaleidos

## Resumo Executivo

Continuar a transformação do kAI para sistema interno, removendo completamente referências a workspaces externos, planos de pagamento e upgrades da interface.

**Estado atual (após implementação anterior):**
- ✅ Rota "/" já redireciona para /kaleidos
- ✅ `usePlanFeatures` e `usePlanLimits` simplificados
- ✅ `useUpgradePrompt` mostra mensagem de permissão
- ✅ `KaiSidebar` usa permissões por role
- ✅ `PlanBillingCard` simplificado para "Plano Interno"
- ✅ `SidebarUpgradeCTA` desativado
- ✅ `WorkspaceSwitcher` sem opção de criar

**O que ainda falta:**
- Páginas de workspace legadas (NoWorkspacePage, CreateWorkspaceCallback)
- Componentes com texto de "upgrade" e "plano Pro"
- Documentação interna desatualizada
- Remoção de rotas desnecessárias

---

## Fase 1: Simplificar NoWorkspacePage (Alto Impacto)

### Problema
A página `NoWorkspacePage` oferece opção de "Criar Workspace" com Stripe, que não é mais relevante.

### Solução
Transformar em página de "Aguardando Acesso" que orienta o usuário a solicitar convite.

**Arquivo:** `src/pages/NoWorkspacePage.tsx`

**Mudanças:**
- Remover import de `CreateWorkspaceDialog`
- Remover card "Criar Workspace" com botão de pagamento
- Manter apenas a seção de verificar convites pendentes
- Simplificar a mensagem para "Solicite acesso ao administrador"
- Remover estados relacionados a criar workspace

---

## Fase 2: Remover Rotas e Páginas Obsoletas

### 2.1 Rotas a remover do App.tsx

**Arquivo:** `src/App.tsx`

Remover estas rotas (código permanece nos arquivos, apenas não roteado):
```text
- /create-workspace → Já redireciona para /signup, pode ser removido
- /create-workspace-callback → Página de callback do Stripe
```

### 2.2 Simplificar rota /no-workspace

Manter a rota mas com a página simplificada (Fase 1).

---

## Fase 3: Limpar Textos de Upgrade na Interface

### 3.1 AddToPlanningButton.tsx

**Arquivo:** `src/components/chat/AddToPlanningButton.tsx`

**Mudança:** O tooltip "Disponível no plano Pro" deve mudar para mensagem de permissão.

Atualmente (linha 104-106):
```tsx
<TooltipContent>
  <p>Disponível no plano Pro</p>
</TooltipContent>
```

Novo:
```tsx
<TooltipContent>
  <p>Você não tem permissão para esta ação</p>
</TooltipContent>
```

### 3.2 ContentOutputNode.tsx

**Arquivo:** `src/components/kai/canvas/nodes/ContentOutputNode.tsx`

**Mudança:** Linha 534 "Disponível no plano Pro" → "Você não tem permissão para esta ação"

### 3.3 ClientsManagementTool.tsx

**Arquivo:** `src/components/kai/tools/ClientsManagementTool.tsx`

**Mudança:** A mensagem de `showUpgradePrompt` já foi alterada no hook. Verificar se há texto fixo de plano.

### 3.4 ClientEditTabsSimplified.tsx

**Arquivo:** `src/components/clients/ClientEditTabsSimplified.tsx`

**Mudança:** Linhas 310-324 - Bloco "Integrações PRO" com botão "Fazer upgrade"

Atualmente mostra:
- "Integrações PRO"
- "Conecte redes sociais e publique diretamente com o plano PRO"
- Botão "Fazer upgrade"

Como `isPro` agora é sempre `true` (usePlanFeatures retorna tudo true), este bloco nunca aparece. Mas para limpeza do código, podemos remover a condicional e sempre mostrar `SocialIntegrationsTab`.

---

## Fase 4: Atualizar Documentação Interna

### 4.1 Documentation.tsx

**Arquivo:** `src/pages/Documentation.tsx`

**Mudanças em múltiplas seções:**

1. **Linha 536-537**: "Convide membros para seu workspace" → "Convide membros para a equipe"

2. **Linha 555-558**: Seção "Plano e Tokens" - Remover menção a "faça upgrade"
   ```text
   Antes: "Visualize seu plano atual, consumo de tokens e faça upgrade se necessário."
   Depois: "Visualize informações de uso e consumo de tokens."
   ```

3. **Linha 773**: "Excluir Workspace" → "Excluir Dados" (ou remover linha)

4. **Linha 852**: "Verifique sua role no workspace" → "Verifique sua role na equipe"

### 4.2 Help.tsx

**Arquivo:** `src/pages/Help.tsx`

Verificar se há links de pricing ou upgrade remanescentes. (Já foram removidos na implementação anterior, confirmar)

---

## Fase 5: Remover Componentes de Dialogs de Upgrade

### 5.1 Desativar UpgradePlanDialog

O dialog `UpgradePlanDialog.tsx` não será deletado, mas garantir que não seja renderizado em nenhum lugar.

Verificar se há algum componente ainda usando:
- `<UpgradePlanDialog />`

### 5.2 Desativar CreateWorkspaceDialog

O dialog `CreateWorkspaceDialog.tsx` não será deletado, mas garantir que não seja renderizado.

Atualmente usado em:
- `NoWorkspacePage.tsx` → Remover nesta atualização

---

## Fase 6: Consolidar Terminologia

### Substituições globais de texto

| Termo Antigo | Termo Novo |
|--------------|------------|
| "workspace" | "equipe" ou simplesmente remover |
| "seu workspace" | "sua equipe" |
| "plano Pro" | remover ou "acesso completo" |
| "fazer upgrade" | "solicitar acesso" |
| "Disponível no Pro" | "Requer permissão de membro" |

### Arquivos para revisar:

1. `TeamManagement.tsx` - Linha 356-358: Descrição menciona "workspace"
2. `WorkspaceGuard.tsx` - Mensagens de erro (podem manter pois são técnicas)
3. `PendingAccessOverlay.tsx` - Verificar texto

---

## Resumo de Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/NoWorkspacePage.tsx` | Simplificar para "Aguardando Acesso" |
| `src/App.tsx` | Remover rota /create-workspace-callback |
| `src/components/chat/AddToPlanningButton.tsx` | Mudar tooltip de "plano Pro" |
| `src/components/kai/canvas/nodes/ContentOutputNode.tsx` | Mudar texto de "plano Pro" |
| `src/components/clients/ClientEditTabsSimplified.tsx` | Simplificar condicional isPro |
| `src/pages/Documentation.tsx` | Atualizar textos de workspace/plano |
| `src/components/settings/TeamManagement.tsx` | Atualizar descrição |

---

## Arquivos NÃO Deletados (Apenas Desativados)

| Arquivo | Razão |
|--------|-------|
| `CreateWorkspaceDialog.tsx` | Pode ser útil no futuro |
| `UpgradePlanDialog.tsx` | Pode ser útil no futuro |
| `CreateWorkspaceCallback.tsx` | Página de callback, mantida |

---

## Ordem de Execução

1. **Fase 1** - NoWorkspacePage (5 min)
2. **Fase 2** - Rotas App.tsx (2 min)
3. **Fase 3** - Textos de upgrade (10 min)
4. **Fase 4** - Documentação (5 min)
5. **Fase 5** - Verificar dialogs (3 min)
6. **Fase 6** - Terminologia (5 min)

**Tempo estimado:** ~30 minutos

---

## Checklist de Validação

Após implementar:

- [ ] /no-workspace mostra apenas "Aguardando convite"
- [ ] Nenhum botão "Fazer upgrade" visível
- [ ] Nenhum texto "Disponível no Pro" ou "plano Pro"
- [ ] Documentação não menciona "seu workspace" como algo criável
- [ ] Settings > Plano mostra apenas "Plano Interno"
- [ ] Nenhum dialog de criar workspace aparece

---

## Impacto na UX

### Antes (SaaS)
```
Usuário sem acesso → "Crie seu workspace" (Stripe) ou "Aguarde convite"
```

### Depois (Interno)
```
Usuário sem acesso → "Solicite acesso ao administrador" + Verificar convites
```

Fluxo simplificado focado em convites e aprovação por admin.
