
# Plano: Remover Social Proof + Corrigir Acessos de Viewer/Member

## Resumo

Este plano aborda três correções:

1. **Landing Page**: Remover texto "+2.400 criadores usando"
2. **Filtragem de Clientes**: Members e Viewers devem ver apenas os clientes aos quais têm acesso
3. **Permissões de Visualização**: Viewers devem poder ver Planejamento, Performance e Biblioteca (somente leitura)

---

## Problema 1: Remover Social Proof da Landing Page

### Localização
`src/components/landing/NewHeroSection.tsx` linhas 762-785

### Solução
Remover o bloco de "user avatars" e o texto "+2.400 criadores usando":

```tsx
// REMOVER este bloco inteiro (linhas 762-785):
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="flex items-center justify-center gap-4 mb-8"
>
  {/* User avatars */}
  <div className="flex -space-x-2">
    {[...].map((bg, i) => (
      <motion.div>...</motion.div>
    ))}
  </div>
  <div className="text-sm text-muted-foreground">
    <span className="text-foreground font-semibold">+2.400</span> criadores usando
  </div>
</motion.div>
```

**Arquivo**: `src/components/landing/NewHeroSection.tsx`

---

## Problema 2: Filtragem de Clientes por Acesso

### Diagnóstico

O hook `useClients` busca todos os clientes do workspace sem verificar se o membro tem acesso:

```typescript
// useClients.ts - Busca TODOS os clientes
const { data: clients = [] } = useQuery({
  queryFn: async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspace.id);
    return data;
  },
});
```

A função `can_access_client` existe no banco mas não é usada na query.

### Solução

Modificar `useClients` para filtrar clientes baseado no acesso do membro:

1. **Buscar o `workspace_member_id` do usuário atual**
2. **Verificar se existem restrições de acesso** (tabela `workspace_member_clients`)
3. **Filtrar a lista de clientes** quando houver restrições

```typescript
// useClients.ts - Modificação

export const useClients = () => {
  const { workspace } = useWorkspaceContext();
  const { userRole, isAdminOrOwner } = useWorkspace();

  // Buscar workspace_member_id do usuário atual
  const { data: currentMember } = useQuery({
    queryKey: ["current-workspace-member", workspace?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id || !workspace?.id) return null;
      
      const { data } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .maybeSingle();
      
      return data;
    },
    enabled: !!workspace?.id,
  });

  // Buscar restrições de acesso do membro
  const { data: memberClientAccess = [] } = useQuery({
    queryKey: ["member-client-access", currentMember?.id],
    queryFn: async () => {
      if (!currentMember?.id) return [];
      
      const { data } = await supabase
        .from("workspace_member_clients")
        .select("client_id")
        .eq("workspace_member_id", currentMember.id);
      
      return data || [];
    },
    enabled: !!currentMember?.id && !isAdminOrOwner,
  });

  // Buscar todos os clientes
  const { data: allClients = [], isLoading } = useQuery({
    queryKey: ["clients", workspace?.id],
    queryFn: async () => {
      // ... query existente
    },
    enabled: !!workspace?.id,
  });

  // Filtrar clientes baseado no acesso
  const clients = useMemo(() => {
    // Admins/Owners veem todos
    if (isAdminOrOwner) return allClients;
    
    // Se não tem restrições, vê todos
    if (memberClientAccess.length === 0) return allClients;
    
    // Filtra apenas os clientes que tem acesso
    const allowedIds = new Set(memberClientAccess.map(m => m.client_id));
    return allClients.filter(c => allowedIds.has(c.id));
  }, [allClients, memberClientAccess, isAdminOrOwner]);

  return { clients, isLoading, ... };
};
```

**Arquivo**: `src/hooks/useClients.ts`

---

## Problema 3: Permissões de Viewer para Ver Funcionalidades

### Diagnóstico

Atualmente as permissões estão configuradas incorretamente:

| Permissão | Atual | Correto |
|-----------|-------|---------|
| `canViewPerformance` | `userRole !== undefined` | Todos podem VER (incluindo viewer) |
| `canViewLibrary` | `userRole !== undefined` | Todos podem VER (incluindo viewer) |
| `hasPlanning` | `isPro` (bloqueia Canvas) | Separar plano de role |
| `canEditInPlanning` | `userRole !== undefined` | `!isViewer` |

O problema principal é que:
1. **`hasPlanning`** no `usePlanFeatures.ts` está ligado ao plano Pro, não ao role
2. A sidebar bloqueia Planejamento para Canvas, mas o viewer deveria poder VER (mesmo no Pro)

### Solução

#### 3.1 Adicionar `canViewPlanning` no `useWorkspace.ts`

```typescript
// useWorkspace.ts

// Viewers podem VER planejamento (somente leitura)
const canViewPlanning = userRole !== undefined;

// Viewers NÃO podem editar
const canEditInPlanning = !isViewer && userRole !== undefined;
```

#### 3.2 Modificar `usePlanFeatures.ts` para não bloquear viewers

O `hasPlanning` deve ser true para qualquer plano Pro, e a sidebar deve usar `canViewPlanning` do workspace ao invés de `hasPlanning` para viewers:

```typescript
// usePlanFeatures.ts - Manter como está (baseado no plano)
const hasPlanning = isPro;
```

#### 3.3 Modificar `KaiSidebar.tsx` para combinar plano + role

```tsx
// KaiSidebar.tsx

const { canViewPlanning, isViewer } = useWorkspace();
const { hasPlanning } = usePlanFeatures();

// Planejamento visível se:
// - Plano tem acesso (hasPlanning) OU
// - Usuário é viewer (viewers sempre podem ver no plano Pro)
const canSeePlanning = hasPlanning || (isPro && canViewPlanning);

<NavItem
  icon={<CalendarDays />}
  label="Planejamento"
  active={activeTab === "planning"}
  onClick={() => canSeePlanning ? onTabChange("planning") : showUpgradePrompt("planning_locked")}
  disabled={!canSeePlanning}
  showLock={!hasPlanning && !canSeePlanning}
/>
```

**Arquivos**:
- `src/hooks/useWorkspace.ts`
- `src/components/kai/KaiSidebar.tsx`

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/landing/NewHeroSection.tsx` | Remover bloco de social proof (linhas 762-785) |
| `src/hooks/useClients.ts` | Adicionar filtragem de clientes por acesso do membro |
| `src/hooks/useWorkspace.ts` | Adicionar `canViewPlanning`, corrigir `canEditInPlanning` |
| `src/components/kai/KaiSidebar.tsx` | Ajustar lógica de visibilidade do Planejamento |

---

## Detalhes Técnicos

### Filtragem de Clientes

A lógica segue a regra existente na função SQL `can_access_client`:

1. **Admins/Owners**: Acesso a todos os clientes do workspace
2. **Members/Viewers SEM restrições**: Acesso a todos (default)
3. **Members/Viewers COM restrições**: Apenas clientes especificados em `workspace_member_clients`

### Permissões por Role

| Role | Planejamento | Performance | Biblioteca |
|------|-------------|-------------|------------|
| Owner | Ver + Editar | Ver | Ver + Editar |
| Admin | Ver + Editar | Ver | Ver + Editar |
| Member | Ver + Editar | Ver | Ver + Editar |
| Viewer | Ver (somente) | Ver (somente) | Ver (somente) |

---

## Ordem de Implementação

1. **Landing Page**: Remover social proof (rápido)
2. **useWorkspace.ts**: Adicionar `canViewPlanning` e corrigir `canEditInPlanning`
3. **useClients.ts**: Implementar filtragem de clientes por acesso
4. **KaiSidebar.tsx**: Ajustar visibilidade do menu baseado nas novas permissões

---

## Resultado Esperado

1. ✅ Landing page sem o texto "+2.400 criadores usando"
2. ✅ Members/Viewers veem apenas clientes aos quais têm acesso
3. ✅ Viewers podem ver Planejamento, Performance e Biblioteca (somente leitura)
4. ✅ Viewers NÃO podem editar nenhum conteúdo
