# 🎨 Design System Completo
> Última atualização: 09 de Março de 2026

**Base:** shadcn/ui + Tailwind CSS  
**Estilo:** Moderno, minimalista, clean

---

## 🎨 CORES (HSL Variables)

### Cores Base:
- `border` - `hsl(var(--border))`
- `input` - `hsl(var(--input))`
- `ring` - `hsl(var(--ring))`
- `background` - `hsl(var(--background))`
- `foreground` - `hsl(var(--foreground))`

### Cores Principais:
- `primary` - Verde Kaleidos (`145 80% 42%`)
- `secondary` - Magenta Kaleidos (`330 85% 55%`)
- `accent` - Laranja (`25 95% 55%`)
- `muted` - Cinza suave (`220 14% 96%`)
- `destructive` - Vermelho (`0 84% 60%`)

### Variáveis CSS Principais:
```css
--background: 0 0% 100%;        /* Light: Branco */
--foreground: 220 15% 15%;      /* Light: Cinza escuro */
--border: 220 13% 91%;         /* Light: Cinza claro */
--card: 0 0% 100%;             /* Light: Branco */
--radius: 0.5rem;              /* Border radius padrão */
```

**Dark Mode:** Todas as cores adaptam automaticamente via HSL variables.

---

## 📝 TIPOGRAFIA

### Fontes:
- **Sans:** `Inter`, `system-ui`, `-apple-system`, `sans-serif`
- **Títulos:** Atelier

### Tamanhos:
- **H1:** `text-5xl` (48px) - `font-semibold` - `leading-tight`
- **H2:** `text-4xl` (36px) - `font-semibold` - `leading-tight`
- **H3:** `text-3xl` (30px) - `font-semibold` - `leading-snug`
- **Base:** `text-base` (16px) - `font-normal` - `leading-relaxed` (1.6)
- **Pequeno:** `text-sm` (14px) - `font-normal` - `leading-relaxed`

### Pesos:
- Regular (400) - Uso principal
- Medium (500) - Ênfase sutil
- Semibold (600) - Títulos
- Bold (700) - Raro

---

## 📏 ESPAÇAMENTO

### Padding:
- `p-4` - 16px (médio)
- `p-6` - 24px (padrão para cards) ⭐
- `p-8` - 32px (generoso)

### Gaps:
- `gap-4` - 16px (médio)
- `gap-6` - 24px (padrão) ⭐
- `gap-8` - 32px (generoso)

### Margens:
- `mb-12` - 48px (padrão entre seções) ⭐
- `mb-16` - 64px (grandes seções)

### Border Radius:
- `rounded-lg` - 12px (padrão)
- `rounded-xl` - 16px (cards modernos) ⭐
- `rounded-2xl` - 20px (cards elevados)

---

## 🧩 COMPONENTES BASE (shadcn/ui)

Button, Input, Textarea, Select, Checkbox, Switch, Card, Tabs, Dialog, Popover, Sheet, Badge, Alert, Toast, Avatar, Tooltip, Table, Chart.

---

## 📦 SOMBRAS

- `shadow-sm` - Muito leve (padrão cards) ⭐
- `shadow-md` - Média (hover states) ⭐
- `shadow-lg` - Grande (cards elevados)

---

## 🎬 TRANSIÇÕES

- `transition-all duration-200` - Padrão ⭐
- `transition-colors duration-150` - Cores

---

## ✅ PADRÕES ESTABELECIDOS

### Cards:
```tsx
className="
  rounded-xl
  border border-border/50
  bg-card
  shadow-sm
  hover:shadow-md
  hover:border-border
  transition-all duration-200
  p-6
"
```

### Botões:
```tsx
className="
  rounded-lg
  px-6 py-2.5
  font-medium
  shadow-sm
  hover:shadow-md
  transition-all duration-200
"
```

### Inputs:
```tsx
className="
  rounded-lg
  border border-input/50
  px-4 py-2.5
  text-sm
  focus-visible:ring-2 focus-visible:ring-ring/50
  transition-all duration-150
"
```

### Sidebar Items:
```tsx
className="
  flex items-center gap-3
  px-3 py-2
  rounded-lg
  text-sm font-medium
  hover:bg-muted/50
  transition-colors duration-150
"
```

---

## 🌓 DARK MODE

Suporte completo via next-themes. Todas as cores adaptam automaticamente.

---

## 🎨 PRINCÍPIOS DE DESIGN MODERNO (Baseado em Referências)

### 1. Espaçamento Generoso
- ✅ Padding mínimo `p-6` (24px) em cards
- ✅ Gaps `gap-6` (24px) ou `gap-8` (32px) em grids
- ✅ Margens `mb-12` (48px) ou `mb-16` (64px) entre seções
- ✅ Muito espaço em branco entre elementos

### 2. Tipografia Clara
- ✅ Line heights generosos (1.6 para body, 1.2-1.3 para títulos)
- ✅ Pesos moderados (semibold para títulos, regular para body)
- ✅ Hierarquia clara (H1: 48px, H2: 36px, H3: 30px)
- ✅ Cores neutras para texto (gray-600, gray-700)

### 3. Visual Limpo e Minimalista
- ✅ Bordas arredondadas suaves (`rounded-xl` para cards, `rounded-lg` para inputs)
- ✅ Sombras muito leves (`shadow-sm` padrão, `shadow-md` no hover)
- ✅ Cores neutras como base (grays, whites)
- ✅ Transparências sutis (`/50`, `/30` para borders)
- ✅ Backgrounds limpos (white, gray-50)

### 4. Interações Elegantes
- ✅ Transições suaves (`duration-200` padrão, `duration-150` para cores)
- ✅ Hover states claros mas não exagerados
- ✅ Focus states acessíveis (`ring-2 ring-ring/50`)
- ✅ Loading states elegantes (skeleton loaders)

### 5. Layouts Organizados
- ✅ Max-width em containers (`max-w-7xl mx-auto`)
- ✅ Padding lateral responsivo (`px-4 md:px-6 lg:px-8`)
- ✅ Grids organizados (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- ✅ Alinhamento consistente

