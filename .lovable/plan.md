
# Plano: Ajustar Cards de Planejamento - Tamanho e Legibilidade

## Diagnóstico

Os cards de planejamento estão muito compactos, dificultando a leitura. Analisando o código:

### Onde os Cards Aparecem

| Local | Arquivo | Problema Atual |
|-------|---------|----------------|
| **Kanban (Board)** | `VirtualizedKanbanColumn.tsx` linha 207 | Passa `compact` como **fixo true** |
| **Lista** | `PlanningBoard.tsx` linha 309-318 | Passa `compact` como **fixo true** |
| **Calendário** | `CalendarView.tsx` | Usa componente próprio `CalendarCard` (separado) |

### Problemas no PlanningItemCard.tsx

1. **Título**: `text-sm` (14px) - OK mas truncado em 2 linhas (`line-clamp-2`)
2. **Descrição**: `text-[11px]` - Muito pequeno e `line-clamp-1` (só 1 linha!)
3. **Padding**: `p-2.5` - Muito apertado
4. **Media Preview**: `h-24` - Altura baixa
5. **Largura da coluna**: `w-72` (288px) - Poderia ser maior

---

## Solução

### 1. Aumentar o PlanningItemCard

```text
┌────────────────────────────────────────┐
│  ANTES (compacto)                      │
│  --------------------------------      │
│  • Título (14px, 2 linhas max)         │
│  • Descrição (11px, 1 linha max)       │
│  • Padding: 10px                       │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  DEPOIS (legível)                      │
│  --------------------------------      │
│  • Título (15px, 3 linhas max)         │
│  • Descrição (13px, 2-3 linhas max)    │
│  • Padding: 14px                       │
│  • Media: altura 32 → 36               │
└────────────────────────────────────────┘
```

### 2. Aumentar Largura das Colunas Kanban

| Elemento | Antes | Depois |
|----------|-------|--------|
| Coluna Kanban | `w-72` (288px) | `w-80` (320px) |
| Mobile | `w-[85vw]` | `w-[90vw]` |

### 3. Remover `compact` Fixo

No Kanban e Lista, usar `compact={false}` por padrão para mostrar mais conteúdo.

---

## Mudanças Detalhadas

### Arquivo 1: `PlanningItemCard.tsx`

**Mudanças no título:**
```text
Linha 179: 
  - Antes: className="font-medium text-sm line-clamp-2"
  - Depois: className="font-medium text-[15px] leading-snug line-clamp-3"
```

**Mudanças na descrição:**
```text
Linha 206:
  - Antes: className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5 ml-4"
  - Depois: className="text-[13px] text-muted-foreground line-clamp-2 mb-2 ml-4 leading-relaxed"
```

**Mudanças no padding:**
```text
Linha 168:
  - Antes: cn(compact ? "" : "p-2.5")
  - Depois: cn(compact ? "p-2" : "p-3.5")
```

**Mudanças no media preview:**
```text
Linha 146:
  - Antes: className="relative h-24 bg-muted/50..."
  - Depois: className="relative h-32 bg-muted/50..."
```

### Arquivo 2: `VirtualizedKanbanColumn.tsx`

**Largura da coluna:**
```text
Linha 127:
  - Antes: !className && "w-72"
  - Depois: !className && "w-80"
```

**Remover compact fixo:**
```text
Linha 215:
  - Antes: compact
  - Depois: compact={false}
```

### Arquivo 3: `KanbanView.tsx`

**Mobile width:**
```text
Linha 126:
  - Antes: className={isMobile ? "w-[85vw] min-w-[85vw]..." 
  - Depois: className={isMobile ? "w-[90vw] min-w-[90vw]..."
```

### Arquivo 4: `PlanningBoard.tsx`

**Lista view - remover compact:**
```text
Linha 317:
  - Antes: compact
  - Depois: compact={false}
```

---

## Comparativo Visual

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         ANTES vs DEPOIS                             │
├────────────────────────────┬────────────────────────────────────────┤
│        ANTES (288px)       │           DEPOIS (320px)               │
├────────────────────────────┼────────────────────────────────────────┤
│ ┌────────────────────────┐ │ ┌──────────────────────────────────┐   │
│ │ • Post Instagram      │ │ │ • Post Instagram sobre           │   │
│ │   preview...          │ │ │   lançamento de produto          │   │
│ │ 📸 12/02              │ │ │                                  │   │
│ └────────────────────────┘ │ │   Descrição mais longa que       │   │
│                            │ │   agora aparece em duas linhas   │   │
│                            │ │                                  │   │
│                            │ │ 📸 12/02    👤                   │   │
│                            │ └──────────────────────────────────┘   │
└────────────────────────────┴────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/planning/PlanningItemCard.tsx` | Título maior, descrição maior, padding maior, media mais alta |
| `src/components/planning/VirtualizedKanbanColumn.tsx` | Coluna mais larga, remover compact fixo |
| `src/components/planning/KanbanView.tsx` | Mobile width maior |
| `src/components/planning/PlanningBoard.tsx` | Remover compact na view lista |

---

## Resultado Esperado

1. **Cards mais legíveis** - Texto maior e mais linhas visíveis
2. **Colunas mais espaçosas** - 320px ao invés de 288px
3. **Descrição visível** - 2-3 linhas ao invés de 1
4. **Imagens maiores** - Altura de 128px ao invés de 96px
5. **Consistência** - Mesmas melhorias em Kanban, Lista e onde mais aparecer
