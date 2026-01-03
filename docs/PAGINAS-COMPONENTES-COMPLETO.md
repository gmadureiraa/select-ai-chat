# 📄 Páginas e Componentes - Completo

**Objetivo:** Documentação completa e detalhada de todas as páginas e componentes principais do sistema.

---

## 🏠 PÁGINAS PRINCIPAIS

### Landing Page
**Arquivo:** `src/pages/LandingPage.tsx` | **Rota:** `/`

**Estrutura:** 15 seções principais em ordem vertical

1. **NewLandingHeader** - Header fixo com navegação
2. **NewHeroSection** - Hero principal com CTA
3. **ServicesCarousel** - Carrossel de serviços
4. **StatsSection** - Estatísticas e números
5. **AboutSection** - Sobre o produto
6. **AgentFlowSection** - Fluxo de agentes de IA
7. **PlannerDiagramSection** - Diagrama do planejador
8. **WorkflowSection** - Workflow e processos
9. **FeaturesGrid** - Grid de features
10. **IntegrationsOrbit** - Integrações disponíveis
11. **TestimonialsSection** - Depoimentos de clientes
12. **PricingSection** - Planos e preços
13. **FAQSection** - Perguntas frequentes
14. **CTASection** - Call-to-action final
15. **LandingFooter** - Footer com links

#### Hero Section - Copy Final:
- **H1:** "A plataforma de conteúdo feita para Agências, startups, equipes, SaaS"
- **Subtítulo:** "Produza, automatize, programe, organize e veja os resultados de tudo criado."
- **CTA Principal:** "Começar Grátis"
- **CTA Secundário:** "Ver Funcionalidades →"

#### Feature Cards (3 cards abaixo do CTA):
1. **"Velocidade total"** - "Crie conteúdo em segundos"
2. **"Multi-clientes"** - "Gerencie múltiplos clientes em um só lugar"
3. **"Templates ilimitados"** - "Cada cliente com sua identidade única"

---

### Página Kai (Principal)
**Arquivo:** `src/pages/Kai.tsx` | **Rota:** `/:slug` (workspace principal)

#### Layout Principal:
```
┌─────────────────────────────────────────────┐
│ KaiSidebar (esquerda, 256px ou 64px)        │
│ ┌─────────────┐                             │
│ │ Logo + Tokens│                             │
│ │ Busca        │ ← Só quando expandido       │
│ │ Cliente      │ ← Dropdown de seleção       │
│ │             │                             │
│ │ CLIENTE     │ ← Seção                      │
│ │ 🏠 Início   │ ← Tabs por cliente           │
│ │ 💬 Assistente│                             │
│ │ 📊 Performance│ ← Se canViewPerformance    │
│ │ 📚 Biblioteca│ ← Se canViewLibrary         │
│ │             │                             │
│ │ FERRAMENTAS │ ← Seção                      │
│ │ 📖 Base...  │ ← Se canViewKnowledgeBase    │
│ │ 📅 Planejamento│ ← Visível para todos      │
│ │ ⚡ Automações│ ← Visível para todos        │
│ │ 📋 Regras...│ ← Visível para todos         │
│ │             │                             │
│ │ CONTA       │ ← Seção                      │
│ │ 🏢 Clientes │ ← Se canViewClients          │
│ │ 👥 Equipe   │ ← Se canManageTeam           │
│ │ 📊 Atividades│ ← Se canViewActivities      │
│ │ ⚙️ Config...│ ← Link para /settings        │
│ │ ❓ Ajuda    │ ← Link para /docs             │
│ │             │                             │
│ │ [Recolher] │ ← Toggle collapse            │
│ │             │                             │
│ │ [Avatar]    │ ← Footer com usuário         │
│ └─────────────┘                             │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Conteúdo Principal (direita)            │ │
│ │                                         │ │
│ │ [Tab selecionada renderiza aqui]       │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

#### Tabs por Cliente (Requerem cliente selecionado):

**1. `home` - GradientHero**
- Hero visual com gradiente
- Mensagem de boas-vindas
- Quick actions (botões rápidos)
- Aceita `onSubmit` e `onQuickAction` como props
- **Fluxo:** `onSubmit` → Envia mensagem e muda para tab `assistant`

**2. `assistant` - KaiAssistantTab**
- Chat com IA para criar conteúdo
- Sistema de @ mentions (via `FloatingInput`)
- Geração de imagens
- Histórico de conversas (via `ChatOptionsSidebar`)
- Ações rápidas (editar, adicionar ao planejamento)
- Sidebar colapsável

**3. `performance` - Performance Dashboards**
- Dashboard de métricas (Instagram, YouTube, Newsletter, etc)
- KPIs e gráficos
- Comparações com período anterior
- Importação de dados (CSV, OAuth)

**4. `library` - Biblioteca de Conteúdo**
- Visualização de conteúdo criado
- Filtros por tipo, data, cliente
- Preview e edição
- Exportação

#### Tabs Globais (Não requerem cliente):

**1. `knowledge-base` - Base de Conhecimento**
- Upload e gestão de documentos
- Busca semântica
- Categorização
- Conhecimento global e por cliente

**2. `planning` - PlanningBoard**
- View Kanban e Calendário
- Criação e edição de itens
- Agendamento de publicação
- Drag & drop

**3. `automations` - Automações**
- Workflows visuais
- Automações agendadas
- Integrações N8N
- Execução e logs

**4. `activities` - Atividades**
- Feed de atividades do workspace
- Histórico de ações
- Filtros por tipo, usuário, data

**5. `team` - Gestão de Equipe**
- Membros do workspace
- Permissões e roles
- Convites
- Atividades por membro

**6. `clients` - Gestão de Clientes**
- Lista de clientes
- Criação e edição
- Identidade e branding
- Configurações

**7. `format-rules` - Regras de Formato**
- Templates e regras por formato
- Personalização de formatos
- Validações

---

### Settings
**Arquivo:** `src/pages/Settings.tsx` | **Rota:** `/:slug/settings`

**Seções:**
1. **Perfil** - Dados do usuário, avatar, preferências
2. **Workspace** - Configurações do workspace, nome, domínio
3. **Integrações** - Conexões OAuth (YouTube, Instagram), APIs (Twitter, LinkedIn)
4. **Billing** - Assinatura, planos, histórico de pagamentos
5. **Notificações** - Preferências de notificações
6. **Segurança** - Senha, autenticação, sessões

---

## 🧩 COMPONENTES PRINCIPAIS

### GradientHero
**Arquivo:** `src/components/kai/GradientHero.tsx`

**Função:** Hero da página inicial do cliente (tab `home`)

**Estrutura:**
- Background com gradiente
- Mensagem de boas-vindas personalizada
- Input glassmorphism para criar conteúdo
- Quick actions (botões rápidos)

**Padrões de Design:**
- Input container: `rounded-xl`, `p-6`, `shadow-md`, `bg-card/50`
- Content type pills: `rounded-full`, `px-4 py-2`, `bg-muted/50`
- Gap entre elementos: `gap-6`

**Props:**
- `clientName?: string`
- `onSubmit?: (message: string, contentType?: string) => void`
- `onQuickAction?: (action: string) => void`

---

### FloatingInput
**Arquivo:** `src/components/chat/FloatingInput.tsx`

**Função:** Input do chat com suporte a @ mentions

**Funcionalidades:**
- Input de texto com expansão automática
- Sistema de @ mentions (usuários, agentes, formatos)
- Autocomplete para mentions
- Envio com Enter ou botão

**Padrões de Design:**
- `rounded-xl`, `px-4 py-3`, `shadow-sm`
- Focus ring: `ring-2 ring-ring/50`
- Background: `bg-card`

---

### KaiAssistantTab
**Arquivo:** `src/components/kai/KaiAssistantTab.tsx`

**Função:** Tab principal do assistente de IA

**Estrutura:**
```
┌─────────────────────────────────────┐
│ Header: Toggle Sidebar              │
├─────────────────────────────────────┤
│ ChatOptionsSidebar (esq, opcional) │
│                                     │
│ ScrollArea (centro)                 │
│ - EnhancedMessageBubble             │
│ - MinimalProgress                    │
│ - QuickSuggestions                   │
│                                     │
│ FloatingInput (baixo)                │
└─────────────────────────────────────┘
```

**Funcionalidades:**
- Chat com IA (Gemini)
- Histórico de conversas
- Geração de imagens
- Ações rápidas (editar, adicionar ao planejamento)
- Sidebar colapsável com opções

---

### PlanningBoard
**Arquivo:** `src/components/planning/PlanningBoard.tsx`

**Função:** Board de planejamento (Kanban e Calendário)

**Views:**
1. **KanbanView** - Colunas: Backlog, Para Fazer, Em Progresso, Agendado, Publicado
2. **CalendarView** - Visualização mensal/semanal

**Funcionalidades:**
- Drag & drop (Kanban)
- Criação de itens
- Edição de itens
- Agendamento de publicação
- Filtros e busca

---

### KanbanView
**Arquivo:** `src/components/planning/KanbanView.tsx`

**Função:** View Kanban do planejamento com drag & drop

**Estrutura:**
- Colunas: Backlog, Para Fazer, Em Progresso, Agendado, Publicado
- Cards arrastáveis entre colunas
- Indicadores de quantidade por coluna

**Padrões de Design:**
- Colunas: `rounded-xl`, `p-4` ou `p-6`, `shadow-sm`, `gap-4`
- Gap entre colunas: `gap-6`
- Cards: `hover:shadow-md`, `transition-all duration-200`
- Background colunas: `bg-muted/30`

---

### CalendarView
**Arquivo:** `src/components/planning/CalendarView.tsx`

**Função:** View calendário do planejamento

**Estrutura:**
- Grid mensal/semanal
- Eventos por data
- Indicadores visuais de status
- Navegação entre meses

**Padrões de Design:**
- Células: `rounded-lg`, `p-2` ou `p-3`
- Eventos: `gap-2`, `rounded-md`
- Hover states suaves

---

### ThreadEditor / RichContentEditor
**Arquivos:** `src/components/planning/ThreadEditor.tsx`, `RichContentEditor.tsx`

**Função:** Editores de conteúdo

**ThreadEditor:**
- Editor específico para threads (Twitter/X)
- Contagem de caracteres por tweet
- Preview de thread

**RichContentEditor:**
- Editor markdown rico
- Preview
- Formatação

**Padrões de Design:**
- Container: `rounded-xl`, `p-6`, `border-border/50`, `shadow-sm`
- Toolbar: `rounded-lg`, `bg-muted/50`

---

### ChatOptionsSidebar
**Arquivo:** `src/components/assistant/ChatOptionsSidebar.tsx`

**Função:** Sidebar de opções do chat

**Funcionalidades:**
- Histórico de conversas
- Opções de configuração
- Ações rápidas

**Padrões de Design:**
- `p-4` ou `p-6`, `gap-2`
- Itens: `rounded-lg`, `hover:bg-muted/50`
- Transições: `transition-colors duration-150`

---

### PlanningItemDialog
**Arquivo:** `src/components/planning/PlanningItemDialog.tsx`

**Função:** Dialog de criação/edição de itens de planejamento

**Estrutura:**
- Formulário completo
- Seleção de formato
- Data de publicação
- Status
- Mídia e referências

**Padrões de Design:**
- Dialog padrão shadcn/ui
- Form fields: `rounded-lg`
- Botões: padrão do design system

---

### MediaUploader
**Arquivo:** `src/components/planning/MediaUploader.tsx`

**Função:** Upload de mídia para planejamento

**Funcionalidades:**
- Drag & drop
- Preview de imagens
- Múltiplos arquivos
- Progress tracking

**Padrões de Design:**
- Dropzone: `rounded-xl`, `border-border/50`, `p-6`
- Hover: `border-primary/50`
- Transições suaves

---

### StatCard
**Arquivo:** `src/components/performance/StatCard.tsx`

**Função:** Card de métricas (KPIs)

**Estrutura:**
- Valor principal (grande)
- Label
- Variação percentual (vs período anterior)
- Sparkline (mini gráfico)

**Padrões de Design:**
- `rounded-xl`, `p-6`, `shadow-sm`
- `hover:shadow-md`
- Border: `border-border/50`

---

### EnhancedAreaChart
**Arquivo:** `src/components/performance/EnhancedAreaChart.tsx`

**Função:** Gráfico de área para métricas

**Funcionalidades:**
- Múltiplas séries
- Tooltips interativos
- Legenda
- Comparação com período anterior

**Padrões de Design:**
- Container: `rounded-xl`, `p-6`
- Background: `bg-card`

---

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

**ContentCard:**
- Conteúdo criado
- Altura fixa: 280px
- Preview de conteúdo
- Ações rápidas

**PlanningItemCard:**
- Itens de planejamento (Kanban/Calendário)
- Status visual
- Data de publicação
- Formato indicado

**ReferenceCard:**
- Referências visuais
- Preview de imagem
- Tags e categorias

**StatCard:**
- Métricas e KPIs
- Valor grande
- Variação percentual
- Sparkline

**Cores por tipo:**
- Newsletter: blue
- Carousel: pink
- Stories: orange
- Tweet: azul Twitter
- LinkedIn: azul LinkedIn

---

## 📤 PADRÕES DE UPLOAD

### MediaUploader
- Drag & drop
- Preview de imagens
- Múltiplos arquivos
- Progress tracking
- Validação de tipos

### VisualReferencesManager
- Upload de referências visuais
- Categorização
- Tags
- Organização por cliente

---

## ✅ PADRÕES DE DESIGN APLICADOS

### Espaçamento:
- Cards: `p-6` (24px) mínimo
- Gaps: `gap-6` (24px) padrão
- Margens entre seções: `mb-12` (48px)

### Bordas:
- Cards: `rounded-xl` (16px)
- Inputs: `rounded-lg` (12px)
- Botões: `rounded-lg` (12px)

### Sombras:
- Cards: `shadow-sm` padrão
- Hover: `shadow-md`
- Elevated: `shadow-lg`

### Transições:
- Padrão: `transition-all duration-200`
- Cores: `transition-colors duration-150`

---

**Nota:** Este documento consolida toda a informação sobre páginas e componentes do sistema, incluindo estrutura, funcionalidades e padrões de design aplicados.

