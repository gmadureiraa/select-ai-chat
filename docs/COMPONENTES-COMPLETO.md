# 🧩 Componentes e Padrões - Completo

## 🎴 PADRÕES DE CARDS

### Card Padrão (Design Moderno):
```tsx
className="
  rounded-xl              // Bordas arredondadas suaves
  border border-border/50 // Borda sutil
  bg-card                 // Background limpo
  shadow-sm               // Sombra muito leve
  hover:shadow-md         // Sombra no hover (elegante)
  hover:border-border     // Borda no hover
  transition-all duration-200
  p-6                     // Padding generoso
"
```

### Tipos de Cards:
- **ContentCard** - Conteúdo criado (altura 280px fixa)
- **PlanningItemCard** - Itens de planejamento (Kanban/Calendário)
- **ReferenceCard** - Referências visuais
- **StatCard** - Métricas e KPIs

**Cores por tipo:** Newsletter (blue), Carousel (pink), Stories (orange), etc.

---

## 🎨 COMPONENTES PRINCIPAIS

### GradientHero
**Arquivo:** `src/components/kai/GradientHero.tsx`

Hero da página inicial com gradiente e input glassmorphism.

**Padrões:**
- Input container: `rounded-xl`, `p-6`, `shadow-md`, `bg-card/50`
- Content type pills: `rounded-full`, `px-4 py-2`, `bg-muted/50`
- Gap entre elementos: `gap-6`

### FloatingInput
**Arquivo:** `src/components/chat/FloatingInput.tsx`

Input do chat com suporte a @ mentions.

**Padrões:**
- `rounded-xl`, `px-4 py-3`, `shadow-sm`
- Focus ring: `ring-2 ring-ring/50`

### KanbanView
**Arquivo:** `src/components/planning/KanbanView.tsx`

View Kanban do planejamento com drag & drop.

**Padrões:**
- Colunas: `rounded-xl`, `p-4` ou `p-6`, `shadow-sm`, `gap-4`
- Gap entre colunas: `gap-6`
- Cards: `hover:shadow-md`, `transition-all duration-200`

### CalendarView
**Arquivo:** `src/components/planning/CalendarView.tsx`

View calendário do planejamento.

**Padrões:**
- Células: `rounded-lg`, `p-2` ou `p-3`
- Eventos: `gap-2`

### ThreadEditor / RichContentEditor
**Arquivos:** `src/components/planning/ThreadEditor.tsx`, `RichContentEditor.tsx`

Editores de conteúdo.

**Padrões:**
- Container: `rounded-xl`, `p-6`, `border-border/50`, `shadow-sm`

### ChatOptionsSidebar
**Arquivo:** `src/components/assistant/ChatOptionsSidebar.tsx`

Sidebar de opções do chat.

**Padrões:**
- `p-4` ou `p-6`, `gap-2`
- Itens: `rounded-lg`, `hover:bg-muted/50`

### PlanningItemDialog
**Arquivo:** `src/components/planning/PlanningItemDialog.tsx`

Dialog de criação/edição de itens de planejamento.

**Padrões:**
- Dialog padrão shadcn/ui
- Form fields: `rounded-lg`

### MediaUploader
**Arquivo:** `src/components/planning/MediaUploader.tsx`

Upload de mídia para planejamento.

**Padrões:**
- Dropzone: `rounded-xl`, `border-border/50`, `p-6`

---

## 📤 PADRÕES DE UPLOAD

### MediaUploader
- Drag & drop
- Preview de imagens
- Múltiplos arquivos
- Progress tracking

### VisualReferencesManager
- Upload de referências visuais
- Categorização
- Tags

---

**Nota:** Este documento consolida os principais componentes e padrões do sistema.

