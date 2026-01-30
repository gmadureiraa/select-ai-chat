

# Redesign Linear-Style: Planejamento e Landing Page

## Visão Geral

Este plano implementa um redesign completo inspirado no Linear, focando em:
- **Estética minimalista** com fundo escuro dominante
- **Tipografia grande e impactante**
- **Animações sutis e performáticas**
- **Layout limpo com muito espaço em branco (negativo)**
- **Componentes polidos com transições suaves**

---

## Parte 1: Landing Page (Estilo Linear)

### 1.1 Header Redesign

| Atual | Linear-Style |
|-------|--------------|
| Logo + texto "Kaleidos" | Logo minimalista com nome simplificado |
| Nav links básicos | Nav com hover states elegantes |
| Botões CTA padrão | Botões com bordas arredondadas e hover glow |

**Mudanças:**
- Header mais fino (h-14 ao invés de h-16)
- Background transparente até scroll, depois blur sutil
- Links de navegação com underline animado on hover
- Botão "Sign up" com borda branca e hover fill

### 1.2 Hero Section Redesign

**Linear Features a Implementar:**
- Headline gigante (text-5xl md:text-7xl)
- Subtítulo em cinza claro com max-width
- Apenas 1-2 CTAs (não vários botões)
- Demo visual flutuante abaixo (não ao lado)
- Partículas/gradientes sutis de fundo

```text
┌──────────────────────────────────────────────────────┐
│                      [Header]                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│         kAI é a ferramenta definitiva                │
│         para criar conteúdo                          │
│                                                      │
│    Subtítulo em texto muted menor aqui               │
│                                                      │
│            [ Start building → ]                      │
│                                                      │
│   ┌──────────────────────────────────────────────┐   │
│   │                                              │   │
│   │         Canvas Demo (flutuante)              │   │
│   │                                              │   │
│   └──────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 1.3 Social Proof Section (Novo)

Como o Linear mostra "Powering the world's best product teams":

- Faixa com logos de clientes ou badges de confiança
- Texto "Empresas que confiam no kAI" em muted
- Animação de scroll horizontal contínuo (marquee)

### 1.4 Features Grid Redesign

**Linear Style:**
- Cards grandes com ícones minimalistas
- Títulos curtos e impactantes
- Descrições concisas (1-2 linhas)
- Hover state com elevação sutil
- Grid 2x2 ou 3 colunas

**Mudanças:**
- Remover badges coloridos excessivos
- Usar ícones monocromáticos (stroke: 1.5)
- Adicionar gradiente sutil no hover
- Espaçamento mais generoso entre cards

### 1.5 Pricing Section Redesign

**Linear Style (simples e direto):**
- 2 planos principais lado a lado
- Card destacado com borda gradiente (não fill sólido)
- Lista de features com checks minimalistas
- CTA único por card
- Sem animações bounce excessivas

```text
┌─────────────────────────┐  ┌─────────────────────────┐
│         Canvas          │  │  ┌──[Popular]──────┐   │
│                         │  │  │                 │   │
│        $19.90           │  │  │    kAI PRO      │   │
│                         │  │  │    $99.90       │   │
│  • Feature 1            │  │  │                 │   │
│  • Feature 2            │  │  │  • Feature 1    │   │
│  • Feature 3            │  │  │  • Feature 2    │   │
│                         │  │  │  • Feature 3    │   │
│  [ Get Started ]        │  │  │                 │   │
│                         │  │  │ [ Get Started ] │   │
└─────────────────────────┘  │  └─────────────────┘   │
                             └─────────────────────────┘
```

### 1.6 FAQ Section Redesign

- Accordion com animação de altura suave
- Ícone de seta que rotaciona
- Sem bordas excessivas nos items fechados
- Dividers sutis entre items

### 1.7 Footer Redesign

- Grid multi-coluna com links organizados
- Logo à esquerda, social icons à direita
- Cores muted, links com hover underline
- Copyright simples no bottom

---

## Parte 2: Sistema de Planejamento (Estilo Linear)

### 2.1 Layout Geral

**Linear Features:**
- Sidebar colapsável com navegação rápida
- Header de página mínimo
- Área de conteúdo maximizada
- Breadcrumbs sutis

### 2.2 Kanban Board Redesign

**Columns:**
- Header minimalista com dot colorido + nome + count
- Sem backgrounds coloridos nos headers (apenas dot)
- Cards com sombra sutil (shadow-sm)
- Drag preview com rotação e opacidade

```text
┌────────────────────────────────────────────────────────────┐
│ • Ideia  3     • Rascunho  5     • Aprovado  2     +       │
├────────────────────────────────────────────────────────────┤
│ ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│ │ Card 1   │    │ Card 1   │    │ Card 1   │               │
│ │          │    │          │    │          │               │
│ └──────────┘    └──────────┘    └──────────┘               │
│ ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│ │ Card 2   │    │ Card 2   │    │ Card 2   │               │
│ │          │    │          │    │          │               │
│ └──────────┘    └──────────┘    └──────────┘               │
│                 ...            ...                          │
└────────────────────────────────────────────────────────────┘
```

### 2.3 Planning Card Redesign

**Linear Issue Card Style:**
- Título à esquerda, metadata à direita
- Ícone de plataforma como dot colorido pequeno
- Avatar do assignee (se houver) no canto
- Status como badge minimalista
- Hover: elevação + borda sutil

```text
┌────────────────────────────────────────────────┐
│ • Título do conteúdo aqui            ○ Status  │
│   Descrição curta em muted...                  │
│                                                │
│   📅 12/02  • Twitter       👤                 │
└────────────────────────────────────────────────┘
```

**Mudanças Específicas:**
- Remover preview de imagem inline (apenas no dialog)
- Títulos menores (text-sm font-medium)
- Padding reduzido (p-3)
- Border radius menor (rounded-lg ao invés de rounded-xl)
- Cores mais sutis para plataformas

### 2.4 Filters Bar Redesign

**Linear Style:**
- Barra compacta com dropdowns inline
- Chips para filtros ativos
- Botão de clear discreto
- Sem backgrounds nos selects fechados

### 2.5 View Toggle Redesign

- Pills mais compactos
- Transição de background suave
- Ícones sem labels em mobile

### 2.6 Dialog Redesign

**Linear Issue Detail Style:**
- Modal grande com sidebar de propriedades
- Editor de conteúdo à esquerda
- Metadata/assignee/status à direita
- Header minimalista com close button

---

## Parte 3: Tokens de Design

### Cores (Dark Theme Linear)

```css
--background: 0 0% 7%;        /* #121212 - Fundo principal */
--foreground: 0 0% 95%;       /* Texto principal */
--muted: 0 0% 14%;            /* Superfícies elevadas */
--muted-foreground: 0 0% 55%; /* Texto secundário */
--border: 0 0% 18%;           /* Bordas sutis */
--primary: 142 70% 45%;       /* Verde kaleidos */
--accent: 330 80% 60%;        /* Magenta kaleidos */
```

### Tipografia

```css
--font-display: text-5xl md:text-7xl font-semibold tracking-tight
--font-heading: text-2xl md:text-4xl font-semibold
--font-body: text-base font-normal
--font-small: text-sm text-muted-foreground
```

### Espaçamento

```css
--section-padding: py-24 md:py-32
--card-padding: p-6 md:p-8
--gap-grid: gap-6 md:gap-8
```

### Transições

```css
--transition-fast: duration-150 ease-out
--transition-medium: duration-300 ease-out
--transition-slow: duration-500 ease-out
```

---

## Arquivos a Modificar

### Landing Page

| Arquivo | Mudanças |
|---------|----------|
| `NewLandingHeader.tsx` | Header mais fino, nav com hover underline |
| `NewHeroSection.tsx` | Headline maior, layout centralizado, demo abaixo |
| `ValueProposition.tsx` | Cards maiores, menos decoração |
| `CanvasVsProSection.tsx` | Pricing simplificado, 2 cards clean |
| `FAQSection.tsx` | Accordion mais sutil |
| `LandingFooter.tsx` | Footer multi-coluna |
| `StickyMobileCTA.tsx` | CTA mais discreto |

### Sistema de Planejamento

| Arquivo | Mudanças |
|---------|----------|
| `KanbanView.tsx` | Gap reduzido, layout mais tight |
| `VirtualizedKanbanColumn.tsx` | Header minimalista, sem bg colorido |
| `PlanningItemCard.tsx` | Card compacto estilo Linear |
| `PlanningFilters.tsx` | Filters inline sem backgrounds |
| `ViewToggle.tsx` | Pills mais compactos |
| `PlanningBoard.tsx` | Header simplificado |
| `EmptyState.tsx` | Empty state mais elegante |

### Novos Componentes

| Componente | Descrição |
|------------|-----------|
| `SocialProofMarquee.tsx` | Logos em scroll horizontal |
| `LinearCard.tsx` | Card base estilo Linear |
| `LinearButton.tsx` | Botão com hover glow |

---

## Ordem de Implementação

### Fase 1: Foundation (Design Tokens)
1. Atualizar variáveis CSS no `globals.css`
2. Criar utilitários de transição no Tailwind config

### Fase 2: Landing Page
1. `NewLandingHeader.tsx` - Header refinado
2. `NewHeroSection.tsx` - Hero impactante
3. `ValueProposition.tsx` - Seção como funciona
4. `CanvasVsProSection.tsx` - Pricing clean
5. `FAQSection.tsx` - FAQ refinado
6. `LandingFooter.tsx` - Footer organizado

### Fase 3: Planejamento
1. `VirtualizedKanbanColumn.tsx` - Columns minimalistas
2. `PlanningItemCard.tsx` - Cards compactos
3. `PlanningFilters.tsx` - Filters inline
4. `ViewToggle.tsx` - Toggle refinado
5. `PlanningBoard.tsx` - Layout geral

---

## Seção Técnica

### Dependências Necessárias
Nenhuma nova dependência - usaremos as já instaladas:
- `framer-motion` para animações
- `tailwindcss` para estilos
- `lucide-react` para ícones

### Performance Considerations
- Manter virtualization no Kanban
- Lazy load de seções da landing
- Usar `will-change` sparingly
- Preferir `transform` e `opacity` para animações

### Acessibilidade
- Manter contrast ratios adequados
- Focus states visíveis
- Keyboard navigation funcional
- Screen reader labels

