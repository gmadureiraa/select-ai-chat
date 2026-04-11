

# Overview Completo do Kai — Revisão Técnica

## Estado Geral: Muito Bom (8.5/10)

O sistema está funcional e bem estruturado. A maioria dos fluxos principais (chat, planejamento, publicação, métricas, automações) estão operando corretamente. Abaixo listo tudo que encontrei, organizado por severidade.

---

## Problemas Encontrados

### 1. QUERY SEM FILTRO DE WORKSPACE (Bug Crítico)
O `HomeDashboard.tsx` (linha 144) busca **todos** os planning_items sem filtrar por `workspace_id`:
```
.from("planning_items").select(...).order("scheduled_at")
```
Isso pode trazer dados de outros workspaces (RLS protege, mas depende 100% de RLS). Precisa adicionar filtro `.eq("workspace_id", workspaceId)`. Também está sujeito ao limite de 1000 rows do Supabase — com 2100+ itens, parte dos dados é invisível.

### 2. QUERY SEM LIMITE (Performance)
A mesma query do dashboard não tem `.limit()`. Com o crescimento dos dados, isso vai ficar cada vez mais lento.

### 3. Canvas — Código Morto (Limpeza)
A pasta `src/components/kai/canvas/` inteira (~15 arquivos) ainda existe mas não é referenciada por nenhuma rota. São centenas de linhas de código morto que aumentam o bundle. Pode ser removida.

### 4. GradientHero — Código Morto (Limpeza)
`src/components/kai/GradientHero.tsx` não é mais usado em lugar nenhum (foi substituído pelo HomeDashboard). Pode ser removido.

### 5. Publicados Recentemente — Não Clicável
Na seção "Publicados recentemente" (linha 694), os itens **não** têm `onClick={() => onOpenItem?.(item.id)}`, diferente de todas as outras listas. Inconsistência de UX.

### 6. Default fallback para HomeDashboard duplicado (Minor)
No `Kai.tsx` linha 207-212, o `default` case do switch renderiza `HomeDashboard` sem passar `onOpenItem`, então clicar em tarefas nesse fallback não funciona.

### 7. Tema já integrado nas Configurações ✅
Confirmado — "Aparência" está na SettingsNavigation e não há mais item "Tema" solto no sidebar. Resolvido.

### 8. Onboarding check funcional ✅
O `useOnboarding.ts` verifica se o usuário já tem clientes e pula automaticamente. Resolvido.

### 9. Approval workflow funcional ✅
Botões "Aprovar" e "Pedir ajustes" aparecem no footer do PlanningItemDialog quando status é `review`. Funcional.

---

## Plano de Correção

### Passo 1: Corrigir query do Dashboard (Crítico)
- `HomeDashboard.tsx`: Adicionar filtro `workspace_id` e aumentar limit para cobrir todos os itens, ou paginar
- Passar `workspaceId` via props ou context

### Passo 2: Tornar "Publicados recentemente" clicável
- Adicionar `onClick={() => onOpenItem?.(item.id)}` nos itens da seção

### Passo 3: Corrigir fallback do Kai.tsx
- Passar `onOpenItem` no default case ou redirecionar para "home"

### Passo 4: Remover código morto
- Deletar pasta `src/components/kai/canvas/` inteira
- Deletar `src/components/kai/GradientHero.tsx`

---

## Resumo do que já está perfeito
- Sidebar limpa, sem Canvas, sem Tema solto
- Roteamento com redirects corretos para tabs removidas
- Permissões por role (viewer/member/admin/owner)
- Dashboard interativo com filtros, timeline semanal, deep linking
- Fluxo de aprovação operacional
- Onboarding inteligente
- Notificações in-app + push
- Publicação multi-plataforma via Late API
- Automações com voice profile

