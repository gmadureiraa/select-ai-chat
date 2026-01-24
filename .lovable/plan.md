
# Plano: Melhorias de Design nos 3 Principais Ambientes

## Visão Geral

Com base na análise detalhada do código atual e do Design System estabelecido (minimalista, Notion/Linear style), proponho melhorias focadas em **consistência visual**, **microinterações** e **refinamento de UX**.

---

## 🎨 1. CANVAS - Melhorias de Design

### 1.1 Toolbar Flutuante Aprimorada
**Arquivo:** `src/components/kai/canvas/CanvasToolbar.tsx`

**Atual:** Toolbar funcional mas densa, com muitos elementos juntos.

**Melhorias:**
- **Separadores visuais mais claros** entre grupos de ferramentas (Whiteboard | AI Nodes | Templates | Canvas Management)
- **Ícones com estado ativo mais marcante** - usar `bg-primary/20` ao invés de apenas `bg-primary`
- **Tooltips com atalhos** mais visíveis (já existe, melhorar contraste)
- **Glassmorphism refinado** - `bg-background/80` + `saturate-150` para mais "profundidade"

```typescript
// Toolbar container aprimorado
className="absolute top-14 left-1/2 -translate-x-1/2 z-10 
  flex items-center gap-1 px-3 py-2 rounded-xl 
  bg-background/85 backdrop-blur-xl saturate-150 
  border border-border/50 shadow-lg shadow-black/5"
```

### 1.2 Nodes com Visual Mais Polido
**Arquivos:** `AttachmentNode.tsx`, `GeneratorNode.tsx`, `ContentOutputNode.tsx`

**Melhorias:**
- **Cabeçalhos de node** com gradiente sutil baseado no tipo (Anexo = roxo, Gerador = verde, Resultado = azul)
- **Bordas arredondadas mais generosas** (`rounded-xl` ao invés de `rounded-lg`)
- **Status indicators** mais visíveis (conectado/processando/erro)
- **Micro-animação de entrada** quando node é adicionado (`animate-scale-in`)

```typescript
// Node header com gradiente
<div className={cn(
  "px-3 py-2 border-b rounded-t-xl",
  "bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent",
  "border-purple-500/20"
)}>
```

### 1.3 Empty State do Canvas
**Arquivo:** `ContentCanvas.tsx`

**Melhorias:**
- **Ilustração minimalista** ao invés de apenas texto
- **Quick templates** como cards visuais ao invés de dropdown
- **Animação de fade-in** suave nos elementos
- **Dicas contextuais** ("Arraste da biblioteca" ou "Comece com um template")

### 1.4 Biblioteca Drawer Refinada
**Arquivo:** `CanvasLibraryDrawer.tsx`

**Melhorias:**
- **Transição mais suave** ao abrir/fechar (`duration-300` + `ease-out`)
- **Cards de conteúdo com hover states** mais marcantes
- **Preview de imagem ampliada** on hover usando `HoverCard`
- **Indicador de filtro ativo** mais visível

---

## 📋 2. PLANEJAMENTO (Kanban + Calendário) - Melhorias de Design

### 2.1 Kanban Board - Colunas Aprimoradas
**Arquivo:** `VirtualizedKanbanColumn.tsx`

**Atual:** Colunas funcionais mas podem ser mais "Notion-like".

**Melhorias:**
- **Cabeçalhos de coluna colapsáveis** com animação suave
- **Contador de itens** com design mais discreto (pill style)
- **Drop zone animada** - pulse sutil quando arrastando
- **Empty state personalizado** por tipo de coluna
- **Scroll shadows** indicando mais conteúdo acima/abaixo

```typescript
// Coluna com efeito de scroll shadow
<div className="relative flex-1 overflow-hidden">
  {/* Top shadow indicator */}
  <div className={cn(
    "absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-card/80 to-transparent z-10 pointer-events-none transition-opacity",
    scrollTop > 0 ? "opacity-100" : "opacity-0"
  )} />
  
  {/* Cards container */}
  <div className="p-2 space-y-2 overflow-y-auto h-full">
    {/* items */}
  </div>
  
  {/* Bottom shadow indicator */}
  <div className={cn(
    "absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card/80 to-transparent z-10 pointer-events-none transition-opacity",
    hasMoreBelow ? "opacity-100" : "opacity-0"
  )} />
</div>
```

### 2.2 Kanban Cards - PlanningItemCard
**Arquivo:** `PlanningItemCard.tsx`

**Melhorias:**
- **Thumbnail maior** para itens com mídia (h-24 ao invés de h-20)
- **Barra de progresso** mais sutil (altura 2px, cores mais suaves)
- **Platform badge** com ícone mais proeminente
- **Hover state** com elevação e borda colorida
- **Menu de ações** aparecendo com fade suave

```typescript
// Card com hover state aprimorado
className={cn(
  "group bg-card border border-border/40 rounded-xl overflow-hidden",
  "transition-all duration-200",
  "hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20",
  "hover:-translate-y-0.5"
)}
```

### 2.3 Calendar View - Refinamentos
**Arquivo:** `CalendarView.tsx`

**Melhorias:**
- **Dia atual** com destaque mais marcante (anel + background)
- **Cards dentro das células** com tamanho adaptativo
- **Overflow indicator** quando há muitos itens ("+ 3 mais")
- **Drag preview** mais visível ao arrastar entre dias
- **Navegação de mês** com transição animada

```typescript
// Célula do dia atual
<div className={cn(
  "relative p-1 transition-all duration-150",
  isToday && "bg-primary/5 ring-1 ring-primary/30 ring-inset"
)}>
  <span className={cn(
    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
    isToday && "bg-primary text-primary-foreground font-semibold"
  )}>
    {day.getDate()}
  </span>
</div>
```

### 2.4 Header do Planning Board
**Arquivo:** `PlanningBoard.tsx`

**Melhorias:**
- **View Toggle** com transição mais suave entre estados
- **Filtros** como chips descartáveis (removíveis com X)
- **Stats summary** opcional (totais por status)
- **Botão Novo** com dropdown para escolher tipo/coluna

---

## 👤 3. PERFIS (ClientEditDialog) - Melhorias de Design

### 3.1 Dialog Header
**Arquivo:** `ClientEditTabsSimplified.tsx`

**Melhorias:**
- **Avatar maior** e mais proeminente (md → lg)
- **Nome editável inline** com estilo "contenteditable"
- **Status de auto-save** mais discreto (ícone apenas, tooltip no hover)
- **Quick actions** (ver perfil, duplicar) no header

```typescript
// Header com avatar proeminente
<div className="flex items-start gap-6 pb-6 border-b">
  <AvatarUpload
    currentUrl={avatarUrl}
    size="lg" // 64px ao invés de 48px
    className="ring-2 ring-border/50"
  />
  <div className="flex-1 space-y-2">
    <Input
      value={name}
      className="text-xl font-semibold border-0 p-0 h-auto"
    />
    <p className="text-sm text-muted-foreground">{description || "Adicione uma descrição..."}</p>
  </div>
</div>
```

### 3.2 Tabs Navigation
**Atual:** Tabs funcionais mas podem ser mais "móveis".

**Melhorias:**
- **Scrollable tabs** no mobile com indicadores de mais conteúdo
- **Active indicator** animado (slide entre tabs)
- **Ícones coloridos** por categoria

### 3.3 Cards Internos
**Arquivo:** `ClientEditTabsSimplified.tsx`

**Melhorias:**
- **Accordion para seções longas** (ex: Referências)
- **Empty states** ilustrados para cada seção
- **Drag-and-drop** para reordenar itens onde aplicável
- **Preview inline** para documentos/imagens

### 3.4 Integrações
**Melhorias:**
- **Status badges** visuais (Conectado/Desconectado/Erro)
- **One-click connect** com visual de botão grande
- **Última sincronização** timestamp discreto

---

## 🎯 Melhorias Transversais (Todos os Ambientes)

### Microinterações
- **Button press effect**: `active:scale-95` em todos os botões
- **Loading states**: Skeleton loaders consistentes
- **Success feedback**: Toast + confetti sutil para ações importantes
- **Error states**: Shake animation + mensagem clara

### Consistência de Espaçamentos
- **Cards**: Sempre `p-4` ou `p-6`, nunca `p-3`
- **Gaps**: Preferir `gap-4` ou `gap-6`
- **Border radius**: `rounded-lg` para pequenos, `rounded-xl` para cards

### Acessibilidade
- **Focus rings**: Visíveis e consistentes
- **Keyboard navigation**: Tab order lógico
- **Screen reader**: aria-labels em ícones

---

## Arquivos a Modificar

| Ambiente | Arquivo | Tipo de Mudança |
|----------|---------|-----------------|
| Canvas | `CanvasToolbar.tsx` | Glassmorphism, separadores, estados ativos |
| Canvas | `ContentCanvas.tsx` | Empty state ilustrado, animações |
| Canvas | Node components | Headers gradientes, bordas, status |
| Canvas | `CanvasLibraryDrawer.tsx` | Transições, hover states |
| Planning | `VirtualizedKanbanColumn.tsx` | Scroll shadows, animações drop |
| Planning | `PlanningItemCard.tsx` | Hover elevation, thumbnails maiores |
| Planning | `CalendarView.tsx` | Dia atual, overflow, drag preview |
| Planning | `PlanningBoard.tsx` | View toggle animado, filter chips |
| Perfis | `ClientEditTabsSimplified.tsx` | Avatar maior, tabs animadas |
| Perfis | `ClientEditDialog.tsx` | Padding, max-width |

---

## Priorização Sugerida

### Alta Prioridade (Impacto Visual Imediato)
1. **PlanningItemCard hover states** - usado em todos os lugares
2. **Kanban column scroll shadows** - melhora UX de scroll
3. **Calendar day highlight** - navegação temporal

### Média Prioridade (Refinamentos)
4. **Canvas toolbar glassmorphism** - aparência premium
5. **Node headers com gradiente** - diferenciação visual
6. **Profile avatar sizing** - hierarquia visual

### Baixa Prioridade (Polish)
7. **Microinterações (animações)** - experiência fluida
8. **Empty states ilustrados** - onboarding visual
9. **Transições entre views** - continuidade
