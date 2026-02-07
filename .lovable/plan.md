
# Plano Completo: Consolidar kAI como Ferramenta Interna Única da Kaleidos

## Diagnóstico Atual

### Problema Identificado
O sistema ainda mantém toda a infraestrutura de multi-workspace, permitindo:
1. **WorkspaceSwitcher** ainda funcional - você consegue trocar entre "Kaleidos" e "Agência Digital"
2. **2 workspaces no banco de dados**: `kaleidos` e `agencia`
3. **Páginas legadas ativas**: `NoWorkspacePage`, `JoinWorkspace`, `WorkspaceLogin`, `CreateWorkspaceCallback`
4. **Roteamento baseado em slug**: `/:slug` permite acessar qualquer workspace

### Estado Desejado
- **1 workspace único**: Kaleidos
- **Sem conceito de "workspace"** na interface - apenas "equipe/time"
- **Fluxo simplificado**: Login → Kaleidos (direto)
- **Páginas desnecessárias removidas ou desativadas**

---

## Fase 1: Simplificar Roteamento (Alto Impacto)

### 1.1 Remover rotas de workspace do App.tsx

**Remover/Desativar:**
```text
- /:slug/join → JoinWorkspace.tsx (desativar)
- /:slug/login → WorkspaceLogin.tsx (desativar)
- /no-workspace → NoWorkspacePage.tsx (desativar)
- /create-workspace → já redireciona para /signup (remover)
```

**Manter apenas:**
```text
- /login → Login genérico
- /signup → Cadastro (sem workspace param)
- /kaleidos → App principal
- /kaleidos/docs → Documentação
- /admin → Painel super admin
```

### 1.2 Simplificar WorkspaceRedirect

**Arquivo:** `src/components/WorkspaceRedirect.tsx`

**Mudança:** Em vez de buscar o workspace do usuário, sempre redirecionar para `/kaleidos`:

```typescript
// ANTES: Busca workspace do usuário
const { data } = await supabase.rpc("get_user_workspace_slug", { p_user_id: user.id });
if (data) navigate(`/${data}`);
else navigate("/no-workspace");

// DEPOIS: Sempre vai para Kaleidos
navigate("/kaleidos", { replace: true });
```

### 1.3 Simplificar WorkspaceRouter

**Arquivo:** `src/components/WorkspaceRouter.tsx`

**Mudança:** Remover lógica de slug dinâmico - sempre usar "kaleidos":

```typescript
// Se slug !== "kaleidos", redirecionar para /kaleidos
if (slug && slug !== "kaleidos") {
  return <Navigate to="/kaleidos" replace />;
}
```

---

## Fase 2: Substituir WorkspaceSwitcher por TeamHeader

### 2.1 Transformar WorkspaceSwitcher em componente estático

**Arquivo:** `src/components/kai/WorkspaceSwitcher.tsx`

**Mudança:** Remover toda a lógica de múltiplos workspaces. Exibir apenas:
- Logo Kaleidos
- Nome "Kaleidos"
- Role do usuário (Admin/Membro/Viewer)

**Sem dropdown, sem opção de trocar.**

### 2.2 Renomear para TeamIndicator (opcional)

Para maior clareza conceitual, podemos renomear de `WorkspaceSwitcher` para `TeamIndicator`.

---

## Fase 3: Desativar Páginas Legadas (Sem Deletar)

### 3.1 Páginas a desativar no roteamento

| Página | Ação | Razão |
|--------|------|-------|
| `NoWorkspacePage.tsx` | Remover rota | Usuário sem acesso vê PendingAccessOverlay |
| `JoinWorkspace.tsx` | Remover rota | Não há mais conceito de "entrar em workspace" |
| `WorkspaceLogin.tsx` | Remover rota | Login genérico em /login basta |
| `CreateWorkspaceCallback.tsx` | Manter desativado | Já não está no router |

### 3.2 Ajustar SimpleSignup.tsx

**Arquivo:** `src/pages/SimpleSignup.tsx`

**Remover:**
- Lógica de `workspaceSlug` da query string
- Fetch de workspace name
- Referências a "workspace" no código

---

## Fase 4: Consolidar Contexto e Hooks

### 4.1 Simplificar WorkspaceContext

**Arquivo:** `src/contexts/WorkspaceContext.tsx`

**Mudança:** Remover lógica de slug dinâmico. Sempre carregar workspace "kaleidos":

```typescript
const KALEIDOS_SLUG = "kaleidos";

// Sempre usa slug fixo
const { data: workspace } = useQuery({
  queryKey: ["workspace", KALEIDOS_SLUG],
  queryFn: async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .eq("slug", KALEIDOS_SLUG)
      .single();
    return data;
  },
});
```

### 4.2 Simplificar useUserWorkspaces

**Arquivo:** `src/hooks/useUserWorkspaces.ts`

**Mudança:** Retornar sempre `hasMultipleWorkspaces: false` para garantir que o switcher nunca apareça:

```typescript
return {
  workspaces: workspaces || [],
  isLoading,
  hasMultipleWorkspaces: false, // FORÇAR SEMPRE FALSE
  refetch,
};
```

---

## Fase 5: Limpeza de Terminologia na UI

### 5.1 Substituições de texto

| Local | Antes | Depois |
|-------|-------|--------|
| `PendingAccessOverlay.tsx` | "workspace" | "equipe" |
| `WorkspaceGuard.tsx` | Comentários internos | Atualizar para "team" |
| `TeamManagement.tsx` | "workspace" | "equipe" |
| `Documentation.tsx` | Referências restantes | Atualizar |

### 5.2 Atualizar tooltip do WorkspaceSwitcher

Se mantido como componente, remover tooltips de "Trocar Workspace".

---

## Fase 6: Limpeza de Banco de Dados (Opcional/Manual)

### 6.1 Workspace "Agência Digital"

O segundo workspace (`agencia`) pode ser:
- **Opção A**: Removido manualmente pelo admin
- **Opção B**: Mantido mas inacessível (sem membros ativos)

**Recomendação**: Manter por enquanto, apenas garantir que ninguém tenha acesso.

### 6.2 Verificar memberships

```sql
-- Ver quem tem acesso ao workspace agencia
SELECT * FROM workspace_members 
WHERE workspace_id = '4749c0cf-81c1-4ec1-b7bb-8308f651c475';

-- Se houver membros, podem ser removidos
DELETE FROM workspace_members 
WHERE workspace_id = '4749c0cf-81c1-4ec1-b7bb-8308f651c475';
```

---

## Resumo de Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/App.tsx` | Remover rotas /:slug/join, /:slug/login, /no-workspace |
| `src/components/WorkspaceRedirect.tsx` | Simplificar para redirect fixo /kaleidos |
| `src/components/WorkspaceRouter.tsx` | Forçar slug "kaleidos" ou redirect |
| `src/components/kai/WorkspaceSwitcher.tsx` | Transformar em exibição estática (sem dropdown) |
| `src/hooks/useUserWorkspaces.ts` | Forçar hasMultipleWorkspaces: false |
| `src/contexts/WorkspaceContext.tsx` | Usar slug fixo "kaleidos" |
| `src/pages/SimpleSignup.tsx` | Remover lógica de workspace param |
| `src/components/PendingAccessOverlay.tsx` | Atualizar texto "workspace" → "equipe" |

---

## Arquivos NÃO Deletados

| Arquivo | Status |
|---------|--------|
| `NoWorkspacePage.tsx` | Desativado do router, mantido |
| `JoinWorkspace.tsx` | Desativado do router, mantido |
| `WorkspaceLogin.tsx` | Desativado do router, mantido |
| `CreateWorkspaceCallback.tsx` | Já desativado, mantido |
| `CreateWorkspaceDialog.tsx` | Não usado, mantido |

---

## Fluxo Novo vs Antigo

### Fluxo Antigo (Multi-workspace SaaS)
```
/login → verifica workspace → /{slug} ou /no-workspace
         ↓
     pode trocar workspace via switcher
```

### Fluxo Novo (Interno Kaleidos)
```
/login → /kaleidos (direto)
         ↓
     Sem switcher, sem opção de trocar
     Se não é membro → PendingAccessOverlay
```

---

## Ordem de Execução

1. **Fase 1** - Roteamento (10 min) - Bloqueia acesso a outras rotas
2. **Fase 2** - WorkspaceSwitcher (5 min) - Remove dropdown
3. **Fase 3** - Desativar páginas (5 min) - Limpa rotas
4. **Fase 4** - Contexto/Hooks (10 min) - Fixa workspace
5. **Fase 5** - Terminologia (5 min) - Polish final
6. **Fase 6** - Banco (manual) - Opcional

**Tempo estimado:** ~35 minutos

---

## Checklist de Validação

Após implementar:

- [ ] `/` redireciona para `/kaleidos`
- [ ] `/agencia` redireciona para `/kaleidos` (ou 404)
- [ ] `/no-workspace` retorna 404
- [ ] `/:slug/join` retorna 404
- [ ] `/:slug/login` retorna 404
- [ ] WorkspaceSwitcher não mostra dropdown
- [ ] WorkspaceSwitcher não mostra seta/chevron
- [ ] Nenhum texto "Trocar Workspace" visível
- [ ] Usuário sem acesso vê PendingAccessOverlay (não NoWorkspacePage)
- [ ] Termos "workspace" substituídos por "equipe" na UI

---

## Impacto na Arquitetura

### Componentes que Permanecem Funcionais

O conceito de "workspace" permanece **internamente no código e banco** para:
- Isolamento de dados por cliente
- Sistema de membros e roles
- Tokens e uso de AI

Apenas a **exposição ao usuário** é simplificada - não há mais escolha ou criação de workspaces.

### Manutenção Futura

Se no futuro quiser reativar multi-workspace:
1. Reativar rotas no App.tsx
2. Restaurar lógica do WorkspaceSwitcher
3. Reativar páginas (arquivos ainda existem)
