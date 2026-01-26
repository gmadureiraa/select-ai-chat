
# Plano: Corrigir Sidebar para Viewer

## Problema Identificado

A lógica atual está incorreta de duas formas:

1. **Canvas oculto**: Usa `{!isViewer && ...}` que esconde completamente o Canvas para viewers
   - **Deveria**: Mostrar Canvas bloqueado (com cadeado) para viewers

2. **Planning/Performance/Library bloqueados**: A condição `(canAccessPerformance || (isPro && isViewer))` não está funcionando
   - Mesmo o workspace sendo Enterprise (isPro = true), os itens aparecem com cadeado

O problema está na ordem e lógica das condições. A condição de visibilidade para viewer precisa ser simplificada.

---

## Solução

### Modificações em `src/components/kai/KaiSidebar.tsx`

**1. Canvas - Mostrar bloqueado para Viewer (não ocultar)**

```tsx
// ANTES (linha 280-289):
{!isViewer && (
  <NavItem ... />
)}

// DEPOIS:
{/* Canvas - Bloqueado para Viewers */}
<NavItem
  icon={<Palette className="h-4 w-4" strokeWidth={1.5} />}
  label="Canvas"
  active={activeTab === "canvas"}
  onClick={() => isViewer ? undefined : onTabChange("canvas")}
  collapsed={collapsed}
  disabled={isViewer}
  showLock={isViewer}
/>
```

**2. Planejamento - Simplificar lógica**

```tsx
// ANTES (duas condições conflitantes):
{(canSeePlanning || (isPro && isViewer)) && ( ... funcional ... )}
{!canSeePlanning && !(isPro && isViewer) && ( ... bloqueado ... )}

// DEPOIS:
// Viewer em plano Pro/Enterprise pode ver
// Não-viewer em plano Canvas vê bloqueado
{(hasPlanning || isViewer) ? (
  <NavItem
    icon={<CalendarDays />}
    label="Planejamento"
    active={activeTab === "planning"}
    onClick={() => onTabChange("planning")}
    collapsed={collapsed}
  />
) : (
  <NavItem
    icon={<CalendarDays />}
    label="Planejamento"
    onClick={() => showUpgradePrompt("planning_locked")}
    collapsed={collapsed}
    disabled={true}
    showLock={true}
  />
)}
```

**3. Performance - Mesma lógica**

```tsx
{(canAccessPerformance || isViewer) ? (
  <NavItem
    icon={<BarChart3 />}
    label="Performance"
    active={activeTab === "performance"}
    onClick={() => onTabChange("performance")}
    collapsed={collapsed}
  />
) : (
  <NavItem
    icon={<BarChart3 />}
    label="Performance"
    onClick={() => showUpgradePrompt("performance_locked")}
    collapsed={collapsed}
    disabled={true}
    showLock={true}
  />
)}
```

**4. Biblioteca - Mesma lógica**

```tsx
{(canAccessLibrary || isViewer) ? (
  <NavItem
    icon={<Library />}
    label="Biblioteca"
    active={activeTab === "library"}
    onClick={() => onTabChange("library")}
    collapsed={collapsed}
  />
) : (
  <NavItem
    icon={<Library />}
    label="Biblioteca"
    onClick={() => showUpgradePrompt("library_locked")}
    collapsed={collapsed}
    disabled={true}
    showLock={true}
  />
)}
```

---

## Lógica Corrigida

| Item | Viewer | Member/Admin/Owner (Pro) | Qualquer role (Canvas) |
|------|--------|--------------------------|------------------------|
| Canvas | Bloqueado (cadeado) | Funcional | Funcional |
| Planejamento | Funcional (read-only) | Funcional | Bloqueado (cadeado) |
| Performance | Funcional (read-only) | Funcional | Bloqueado (cadeado) |
| Biblioteca | Funcional (read-only) | Funcional | Bloqueado (cadeado) |

---

## Arquivo a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/kai/KaiSidebar.tsx` | Corrigir lógica de visibilidade para Canvas, Planning, Performance e Library |

---

## Resultado Esperado

1. ✅ **Canvas** aparece no menu para viewer, mas está bloqueado com cadeado
2. ✅ **Planejamento** funcional para viewer (sem cadeado)
3. ✅ **Performance** funcional para viewer (sem cadeado)
4. ✅ **Biblioteca** funcional para viewer (sem cadeado)
5. ✅ Viewer pode navegar e visualizar (somente leitura) Planning, Performance e Library
