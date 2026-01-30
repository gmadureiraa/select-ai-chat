

# Ajustes Complementares: Planejamento e Criação de Conteúdo

## Visão Geral

Após revisão detalhada, o sistema está funcional e bem estruturado. No entanto, identificamos oportunidades de refinamento para aprimorar a experiência, consistência visual e fluidez do Linear-style implementado.

---

## Parte 1: Melhorias no Planejamento

### 1.1 PlanningBoard - Header Refinado

**Problema**: Header ainda tem espaçamento inconsistente com estética Linear.

**Solução**:
- Remover gaps excessivos
- Alinhar ViewToggle e botões em uma linha compacta
- Adicionar breadcrumb sutil "Planejamento > {Cliente}"

| Arquivo | Mudança |
|---------|---------|
| `PlanningBoard.tsx` | Header compactado, breadcrumb opcional |

### 1.2 PlanningItemCard - Polimento Final

**Estado atual**: Bem implementado com dot colorido e layout compacto.

**Melhorias adicionais**:
- Adicionar hover glow sutil (`ring-1 ring-primary/20` on hover)
- Transição suave no título (`group-hover:text-primary` já existe)
- Reduzir padding de `p-3` para `p-2.5` para maior densidade

### 1.3 PlanningItemDialog - Reorganização Linear-Style

**Problema**: Dialog muito longo com muitos campos visíveis por padrão.

**Solução**:
- Dividir em duas colunas no desktop: Editor à esquerda, Propriedades à direita
- Mover campos menos usados (Prioridade, Recorrência) para seção colapsada
- Aumentar destaque do botão "Gerar com IA"

```text
┌─────────────────────────────────────────────────────────────┐
│ [X]                         Novo Card                        │
├────────────────────────────┬────────────────────────────────┤
│                            │ Cliente: [Select...]           │
│  [Título]                  │ Formato: [Tweet ▾]             │
│                            │ Plataforma: Twitter            │
│  [Referência / URL]        │──────────────────────────────  │
│     [🪄 Gerar com IA]      │ Data: [📅 Selecionar]          │
│                            │ Responsável: [👤 Nenhum]       │
│  ┌──────────────────────┐  │──────────────────────────────  │
│  │                      │  │ ▸ Mais opções                  │
│  │   Editor de Conteúdo │  │                                │
│  │                      │  │                                │
│  │                      │  │                                │
│  └──────────────────────┘  │                                │
│                            │                                │
│  [Mídia: 0 itens] [+Gerar] │                                │
├────────────────────────────┴────────────────────────────────┤
│                    [Cancelar] [Publicar Agora] [Salvar]     │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 CalendarView - Ajustes de Densidade

**Estado atual**: Funcional com cards compactos.

**Melhorias**:
- Reduzir padding das células de `p-1.5` para `p-1`
- Usar fonte menor para dias (`text-xs`)
- Hover card mais rápido (openDelay de 300 para 200)

### 1.5 ViewToggle - Estilo Pill Compacto

**Melhorias**:
- Reduzir altura de `h-8` para `h-7`
- Transição de background mais suave
- Borda arredondada unificada (`rounded-lg`)

### 1.6 PlanningFilters - Inline sem Backgrounds

**Estado atual**: Filtros já compactos mas com backgrounds nos selects.

**Melhorias**:
- Remover backgrounds coloridos nos selects fechados
- Usar variant="ghost" onde possível
- Adicionar chips para filtros ativos

---

## Parte 2: Melhorias na Criação de Conteúdo

### 2.1 ContentDialog - Consistência

**Melhorias**:
- Aplicar mesmo layout de duas colunas do PlanningItemDialog
- Botão "Escrever com IA" mais destacado
- Seções colapsáveis para opções avançadas

### 2.2 ContentCard - Hover States

**Melhorias**:
- Adicionar hover glow sutil
- Transição de elevação mais suave
- Badge de tipo menor e inline

### 2.3 RichContentEditor - Refinamento

**Estado atual**: Bem implementado com toolbar e @mentions.

**Melhorias**:
- Toolbar mais compacta (ícones menores `h-3 w-3`)
- Preview mode com melhor padding
- Help text mais discreto

### 2.4 ThreadEditor - Polimento

**Estado atual**: Funcional para Twitter threads.

**Melhorias**:
- Cards individuais de tweets mais compactos
- Contador de caracteres mais discreto
- Drag handle sutil

---

## Parte 3: Outras Páginas Relevantes

### 3.1 KaiLibraryTab - Grid Refinado

**Melhorias**:
- Cards de conteúdo com hover mais elegante
- Grid responsivo otimizado
- Empty state mais Linear

### 3.2 Settings/AutomationsTab - Consistência

**Verificação**: Garantir que seguem mesmo padrão visual.

---

## Arquivos a Modificar

### Prioridade Alta

| Arquivo | Mudanças |
|---------|----------|
| `PlanningItemDialog.tsx` | Layout duas colunas, reorganização de campos |
| `PlanningItemCard.tsx` | Hover glow, padding refinado |
| `ViewToggle.tsx` | Pill menor, transições suaves |
| `PlanningFilters.tsx` | Chips de filtro, sem backgrounds |

### Prioridade Média

| Arquivo | Mudanças |
|---------|----------|
| `ContentDialog.tsx` | Layout consistente |
| `ContentCard.tsx` | Hover states |
| `RichContentEditor.tsx` | Toolbar compacta |
| `ThreadEditor.tsx` | Cards compactos |
| `CalendarView.tsx` | Densidade aumentada |

### Prioridade Baixa

| Arquivo | Mudanças |
|---------|----------|
| `PlanningBoard.tsx` | Header mínimo |
| `EmptyState.tsx` | Visual Linear |
| `VirtualizedKanbanColumn.tsx` | Já bem implementado (ajustes mínimos) |

---

## Ordem de Implementação

### Fase 1: Planejamento Core
1. `PlanningItemCard.tsx` - Hover e densidade
2. `PlanningItemDialog.tsx` - Layout duas colunas
3. `ViewToggle.tsx` - Pill compacto
4. `PlanningFilters.tsx` - Inline sem backgrounds

### Fase 2: Editores
1. `RichContentEditor.tsx` - Toolbar refinada
2. `ThreadEditor.tsx` - Cards compactos
3. `ContentDialog.tsx` - Consistência

### Fase 3: Outras Views
1. `CalendarView.tsx` - Densidade
2. `ContentCard.tsx` - Hover states
3. `EmptyState.tsx` - Minimalismo

---

## Seção Técnica

### Patterns a Aplicar

```css
/* Hover glow sutil */
.card-hover:hover {
  @apply ring-1 ring-primary/10 shadow-sm;
}

/* Transições Linear */
.transition-linear {
  @apply transition-all duration-150 ease-out;
}

/* Pill compacto */
.pill-compact {
  @apply h-7 text-xs px-2 rounded-lg;
}
```

### Performance
- Manter memo() nos cards
- Transições via transform/opacity
- Evitar re-renders desnecessários no Dialog

### Acessibilidade
- Manter focus states visíveis
- Contrast ratios adequados
- Keyboard navigation funcional

---

## Checklist de Validação

| Item | Verificar |
|------|-----------|
| Hover states consistentes | ✓ Cards, botões, links |
| Transições suaves | ✓ 150ms ease-out padrão |
| Densidade aumentada | ✓ Menos whitespace |
| Tipografia | ✓ text-sm para títulos, text-xs para meta |
| Cores | ✓ Dots coloridos, backgrounds neutros |
| Mobile | ✓ Touch targets 44px+ |

