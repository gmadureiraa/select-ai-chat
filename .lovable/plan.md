

# Plano: Logo Kaleidos e Cores por Tema (Verde/Rosa)

## Problema Identificado
A "estrelinha" (`Sparkles` icon) no header do kAI Chat precisa ser substituída pela logo da Kaleidos, e as cores devem variar conforme o tema:
- **Tema Escuro → Logo Verde** (#7cf067)
- **Tema Claro → Logo Rosa** (#d262b2)

Além disso, há cores hardcoded em vários componentes que não respeitam o tema.

---

## Fase 1: Adicionar as Novas Logos ao Projeto

### 1.1 Copiar os SVGs fornecidos

Vou copiar os arquivos enviados para `src/assets/`:
- `Logos-12.svg` → `src/assets/kaleidos-logo-verde.svg` (Green: #7cf067)
- `Logos-11.svg` → `src/assets/kaleidos-logo-rosa.svg` (Pink: #d262b2)
- `Logos-10.svg` → `src/assets/kaleidos-logo-branca.svg` (Branca para fundos escuros se necessário)
- `Logos-09.png` → `src/assets/kaleidos-logo-preta.svg` (Preta para fundos claros se necessário)

---

## Fase 2: Substituir Sparkles no kAI Chat Panel

### 2.1 Atualizar GlobalKAIPanel.tsx
**Arquivo:** `src/components/kai-global/GlobalKAIPanel.tsx`

Substituir o ícone `Sparkles` pela logo dinâmica:

```typescript
import { useTheme } from "next-themes";
import kaleidosLogoVerde from "@/assets/kaleidos-logo-verde.svg";
import kaleidosLogoRosa from "@/assets/kaleidos-logo-rosa.svg";

// No componente:
const { resolvedTheme } = useTheme();
const kaiLogo = resolvedTheme === "dark" ? kaleidosLogoVerde : kaleidosLogoRosa;

// No header, substituir:
<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent flex-shrink-0">
  <Sparkles className="h-4 w-4 text-sidebar-accent-foreground" />
</div>

// Por:
<div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
  <img src={kaiLogo} alt="kAI" className="h-6 w-6 object-contain" />
</div>
```

---

## Fase 3: Atualizar FloatingKAIButton

### 3.1 Usar Cores por Tema
**Arquivo:** `src/components/kai-global/FloatingKAIButton.tsx`

Trocar cores hardcoded por `bg-primary`:

```typescript
// De:
"bg-[#d262b2] hover:bg-[#c050a0]",
"focus:ring-2 focus:ring-[#d262b2]/50",

// Para:
"bg-primary hover:bg-primary/90",
"focus:ring-2 focus:ring-primary/50",
```

E trocar a logo para ser dinâmica conforme o tema:
```typescript
import { useTheme } from "next-themes";
import kaleidosLogoVerde from "@/assets/kaleidos-logo-verde.svg";
import kaleidosLogoRosa from "@/assets/kaleidos-logo-rosa.svg";

const { resolvedTheme } = useTheme();
// No tema escuro, o botão fica verde, então a logo deve ser branca ou contrastante
// No tema claro, o botão fica rosa, então a logo deve ser branca
// Como ambos botões terão fundo colorido, usar logo branca
import kaleidosLogoBranca from "@/assets/kaleidos-logo-branca.svg";

<img src={kaleidosLogoBranca} alt="kAI" className="h-8 w-8 object-contain" />
```

---

## Fase 4: Corrigir Canvas Toolbar

### 4.1 Botão "Rápido" no Canvas
**Arquivo:** `src/components/kai/canvas/CanvasToolbar.tsx`

Substituir o ícone Sparkles pela logo, e usar cores do tema:

```typescript
// De:
className="h-8 gap-1.5 text-xs hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950"
<div className="h-5 w-5 rounded bg-gradient-to-br from-green-500 to-emerald-500 ...">
  <Sparkles ... />
</div>

// Para:
className="h-8 gap-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
<div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
  <img src={kaiLogo} className="h-3.5 w-3.5 object-contain" />
</div>
```

### 4.2 Context Menu
**Arquivo:** `src/components/kai/canvas/components/CanvasContextMenu.tsx`

```typescript
// De:
{ label: "Gerador (IA)", action: "add-generator", icon: Sparkles, color: "text-green-500" },

// Para (usar cor do tema):
{ label: "Gerador (IA)", action: "add-generator", icon: Sparkles, color: "text-primary" },
```

---

## Fase 5: Revisar Cores Hardcoded

### 5.1 Performance/Métricas - Manter Variação
**Arquivo:** `src/components/performance/OverviewInsightsCard.tsx`

Métricas podem ter cores variadas para diferenciação visual - isso pode ficar como está por enquanto, pois você mencionou que Performance pode ser mais colorido.

### 5.2 ContentOutputNode - Usar Cores do Tema
**Arquivo:** `src/components/kai/canvas/nodes/ContentOutputNode.tsx`

```typescript
// De:
data.addedToPlanning ? "bg-green-500" : "bg-pink-500"

// Para:
data.addedToPlanning ? "bg-primary" : "bg-primary/50"
// Ou manter diferença mas usar accent:
data.addedToPlanning ? "bg-accent-foreground" : "bg-muted-foreground"
```

### 5.3 Outros Componentes com Cores Hardcoded

Revisar e substituir padrões como:
- `text-green-500` → `text-primary` (quando representa sucesso/ativo no tema escuro)
- `text-pink-500` → `text-primary` (quando representa destaque no tema claro)
- `bg-green-50`, `bg-pink-50` → `bg-accent`

---

## Fase 6: Gráficos Menos Coloridos

### 6.1 Simplificar Cores dos Charts
**Arquivo:** `src/index.css`

As variáveis de chart já estão configuradas como gradiente monocromático (rosa no claro, verde no escuro). Está correto!

Se quiser simplificar ainda mais, reduzir para 3-4 tons:
```css
/* Light - Pink gradient mais suave */
--chart-1: 330 85% 52%;
--chart-2: 330 60% 65%;
--chart-3: 330 40% 78%;
--chart-4: 330 25% 88%;

/* Dark - Green gradient mais suave */
--chart-1: 150 100% 50%;
--chart-2: 150 70% 42%;
--chart-3: 150 50% 35%;
--chart-4: 150 35% 28%;
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/assets/` | Adicionar 4 novos SVGs de logos coloridas |
| `GlobalKAIPanel.tsx` | Substituir Sparkles por logo dinâmica |
| `FloatingKAIButton.tsx` | Usar `bg-primary` e logo branca |
| `CanvasToolbar.tsx` | Usar logo e cores do tema |
| `CanvasContextMenu.tsx` | Usar `text-primary` |
| `ContentOutputNode.tsx` | Usar cores do tema para status |
| `src/index.css` | Opcional: simplificar chart colors |

---

## Resultado Esperado

| Elemento | Tema Claro | Tema Escuro |
|----------|------------|-------------|
| Logo kAI Chat Header | Rosa (#d262b2) | Verde (#7cf067) |
| Floating Button | Fundo rosa, logo branca | Fundo verde, logo branca |
| Botões destaque | Rosa | Verde |
| Borders/Accents | Tons de rosa | Tons de verde |
| Gráficos | Gradiente rosa | Gradiente verde |

A única exceção será **Planejamento** e **Performance** que podem manter cores adicionais para diferenciação de dados.

