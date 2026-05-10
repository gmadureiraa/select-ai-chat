# KAI 2.0 — Overview Completo (2026-05-09)

> Inventário exaustivo de páginas, tabs, módulos, status de design e funcionalidades.
> Stack: React 18 + Vite + TypeScript + Tailwind v3 + shadcn/ui + Neon Postgres + Vercel Functions + Bun + Supabase Auth (em migração para Neon Auth).
>
> **Status base:** P0 do design audit (`DESIGN-REVIEW-2026-05-09.md`) já corrigidos — 22 cards `bg-card/50`, 7 hooks com staleTime, tokens light/dark do background. Resíduos P1/P2 mapeados.

---

## 🗺️ Mapa de Rotas Top-level (`src/App.tsx`)

| Rota | Componente | Função | Design | Funcionalidade |
|---|---|---|---|---|
| `/` | redirect → `/kaleidos` | — | — | ✅ |
| `/login` | `pages/Login.tsx` | Auth com email/senha + Google OAuth, auto-redirect pra workspace ou `/no-workspace` | 🟢 OK — Card centralizado, ThemeToggle no canto, fluxo limpo | ✅ |
| `/register` + `/signup` | `pages/SimpleSignup.tsx` | Cadastro simplificado, redireciona pra `/kaleidos` | 🟢 OK | ✅ |
| `/kaleidos` (index) | `pages/Kai.tsx` | App principal multi-tab — ver mapa abaixo | 🟢 sidebar + 🟡 conteúdo varia por tab | ✅ |
| `/kaleidos/clients` | `components/clients/ClientsListPage.tsx` | Listagem dedicada (não é a aba interna) com wizard 5-step | 🟡 — duplica funcionalidade de `tab=clients` | ⚠️ duplicado |
| `/no-workspace` | `pages/NoWorkspacePage.tsx` | "Acesso pendente" — verifica convites | 🟢 OK — gradient amber, três cards informativos | ✅ |
| `/export-madureira` | `pages/ExportMadureira.tsx` | Script utilitário (CSV export hard-coded clientId) | ⚫ utility-page — sem UI design | ✅ |
| `/offline` | `pages/Offline.tsx` | PWA fallback offline | 🟢 OK simples e funcional | ✅ |
| `/404` + `*` | `pages/NotFound.tsx` | Página 404 com auto-redirect 10s, código grande de fundo, botão "Reportar" | 🟢 BEM FEITO — Compass animado, `pt-BR` natural, sólida | ✅ |
| `/:slug/*` | redirect → `/kaleidos` | — | — | ✅ |

### Páginas órfãs (existem mas não estão no router)

| Arquivo | Status | Notas |
|---|---|---|
| `pages/JoinWorkspace.tsx` | ❌ órfã | Não importada em App.tsx. Multi-tenant signup via slug — pode ser removida |
| `pages/WorkspaceLogin.tsx` | ❌ órfã | Idem — sem rota. Sobra do plano multi-tenant |
| `pages/Documentation.tsx` | ⚠️ embeddada | Importada por `SettingsTab` (`section=docs`), nunca standalone — mas exporta header próprio com `Back` que só funciona standalone |

---

## 📑 Tabs Internas do `/kaleidos` (`src/pages/Kai.tsx`)

> Tab é controlado por `?tab=<id>`. Cliente atual é `?client=<uuid>`. Atalhos: ⌘K → assistant, ⌘J → carrossel, ⌘I → radar.

### Sidebar — sempre visível (`KaiSidebar.tsx`)
🟢 OK — agrupada em 5 seções (Dashboard · Operação · Engajamento · Análise · Config) + footer (Configurações + collapse + user dropdown). Workspace switcher topo + cliente switcher logo abaixo.

| Tab ID | Componente | Função | Design | Funcionalidade | Notas |
|---|---|---|---|---|---|
| `home` | `kai/home/HomeDashboard` (1073 linhas) | Dashboard com hero saudação + 4 quick actions + pendências + perf snapshot por cliente + top performers + próximos posts + atividade | 🟢 OK pós-fix 2026-05-09 (era 🔴 cards bg-card/40) | ✅ | Refeito 2026-05-09. Alimentado por `useDashboardStats` + `useDashboardClientCards` + `useDashboardTopPosts` + `useDashboardUpcoming` |
| `assistant` | `kai/KaiAssistantTab` | Chat KAI per-cliente com pipeline progress, sugestões, KaiToolsTray, exportação MD/PDF | 🟡 Regular — funciona mas usa tokens slate hardcoded em CitationChip/EnhancedMessageBubble | ✅ | Modo fixo "content"; agente decide rota |
| `planning` | `planning/PlanningBoard` (481 linhas) | Quadro Kanban + List + Calendar com filtros, view settings, ClickUp import, automations | 🟢 OK pós-fix (CalendarView corrigido) | ✅ | Suporta drag-drop, realtime, viewer-restricted clients |
| `tasks` | `tasks/TeamTasksBoard` | Board de tarefas internas (todo/in-progress/done) com filtros + KPIs + calendar | 🟡 Regular — `MyTasksWidget` usado no Home tem status dots hardcoded purple/blue/amber | ✅ | Polling 15s (P1: subir pra 30s) |
| `library` | `kai/KaiLibraryTab` | Biblioteca per-cliente: 5 sub-tabs (Content, References, Visuals, Case Studies, Reports) | 🟢 OK | ✅ | Conteúdo unificado de IG/Twitter/LI |
| `viral-carrossel` | `kai/viral-sv-original/MainApp` | Sequência Viral PORT LITERAL do app standalone — paper cream + REC coral + brutalist | 🟢 OK estética distintiva preservada | ⚠️ port complexo, mini-router via hash | Cópia ~95% do `code/sequencia-viral` |
| `viral-reels-page` | `kai/viral-reels-original/MainApp` | Reels Viral — engenharia reversa de reel via URL IG | 🟢 OK estética cream + REC | ✅ | Histórico via Supabase `viral_reels` per cliente |
| `viral-radar-page` | `kai/viral-radar-original/MainApp` | Radar Viral — Dashboard + Newsletters + Admin | 🟢 OK paper + ink + REC coral | ✅ | Tab "Salvos" removida 2026-05-08 (delegada pra biblioteca) |
| `inbox` | `metricool/MetricoolInboxPanel` (1212 linhas) | Caixa unificada DMs/comments/reviews master-detail + reply box + bulk | 🟡 Regular — gigante, sem virtualização, design Linear-like funcional | ✅ | Polling unread count |
| `performance` | `kai/performance-v2/MetricoolPerformance` | Dashboard métricas Metricool por plataforma (IG/FB/X/LI/TT/YT/Threads) + Comparison tab + best-times | 🟢 OK pós-fix (era 🔴 17+ cards bug) | ✅ | Substituiu CSV+Apify scraper |
| `automations` | `automations/AutomationsTab` (1262 linhas) | 2 main tabs: Planning Automations (schedule/RSS/webhook) + AI Workflows + AI Agents | 🟡 Regular — denso, gestão de cron + workflows + agents num só lugar; pode confundir | ✅ | Visual builder em `visual-builder/` (4 nodes) |
| `clients` | `kai/tools/ClientsManagementTool` | Listagem + cards de clientes + edit/delete | 🟡 Regular — duplica `ClientsListPage`; falta empty state visual | ✅ | |
| `settings` | `settings/SettingsTab` | 13 sections agrupadas (Conta · Workspace · Sistema) | 🟢 OK | ✅ | Ver expansão abaixo |

### Sub-sections de `?tab=settings` (`SettingsNavigation.tsx`)

🟢 Bem organizado em grupos `account` / `workspace` / `system`.

| Section ID | Componente | Função | Status |
|---|---|---|---|
| `profile` | inline em SettingsTab | Avatar + nome + email + reset senha | 🟢 ✅ |
| `notifications` | `settings/NotificationSettings` | Push + email + in-app preferências | 🟢 ✅ |
| `appearance` | inline | Toggle dark/light | 🟢 ✅ |
| `workspace` (owner only) | `workspace/WorkspaceSettingsTab` | Nome workspace, slug, etc | 🟡 não verificado |
| `members` (admin+) | `workspace/WorkspaceMembersTab` | Membros + roles | 🟡 não verificado |
| `team` | `settings/TeamManagement` | Convites + roles | 🟡 não verificado |
| `audit-log` (admin+) | `settings/AuditLogSettings` | Log de ações | 🟡 não verificado |
| `integrations` | `settings/IntegrationsSettings` | OAuth (Late, Postiz, Twitter, LinkedIn) | 🟡 não verificado |
| `mcp` | `kai/MCPDocsTab` | Docs do MCP kAI server (workspace token) | 🔴 tokens zinc/slate hardcoded em ~10 lugares (linhas 77, 229, 265, 284, 289, 344, 387, 391, 395, 423, 461, 475, 517) |
| `radar-sources` (super admin) | `admin/RadarSourcesManager` | Fontes do Radar Viral global | 🔴 tiktok pill `bg-zinc-500/10` hardcoded :108 |
| `ai-usage` | `settings/AIUsageSettings` | Métricas de uso de Gemini/Claude | 🟡 não verificado |
| `webhooks` | `settings/WebhookSettings` | Webhooks externos | 🟡 não verificado |
| `docs` | `pages/Documentation` (embeddada) | Guia em-app com 12 seções + format rules | 🟡 header próprio com Back que só faz sentido standalone |

### Sub-tabs do Perfil do Cliente (`ClientEditTabsSimplified.tsx`) — 9 abas

| Tab ID | Função | Status |
|---|---|---|
| `profile` | Nome + avatar + descrição + segmento + tom + audiência + objetivos | 🟢 ✅ |
| `digital` | Redes sociais + websites | 🟢 ✅ |
| `references` | Documentos + textuais + visuais | 🟢 ✅ |
| `integrations` | OAuth do cliente para publishing | 🟡 ✅ |
| `viral` | Settings dos geradores (Sequência, Reels, Radar) | 🟢 ✅ |
| `ai-context` | Voice profile + identity guide | 🟢 ✅ |
| `mcp` | Tokens MCP per-cliente | 🟡 ✅ |
| `notifications` | Preferências por cliente | 🟡 ✅ |
| `analytics` | Análises | 🟡 ✅ |

### Mobile (`MobileBottomNav.tsx`)
🟢 OK — 4 primary (Home/Planning/kAI/Carrossel) + dropdown "Mais" (Tarefas/Performance/Biblioteca/Reels/Radar/Configurações). KAI no centro com botão grande destacado + ring.

### Componentes globais sempre montados

| Componente | Função | Status |
|---|---|---|
| `GlobalKAIAssistant` | Botão flutuante que abre painel + chat lazy | 🟢 ✅ — gated por `isViewer` |
| `CommandPalette` (⌘K) | Navegação rápida + clientes | 🟢 ✅ |
| `OnboardingFlow` | Wizard de boas-vindas (welcome → criar cliente → mentions) | 🟢 ✅ |
| `NotificationPermissionPrompt` | Pede permissão de push | 🟡 ✅ |
| `PendingInvitesAlert` | Banner para convites pendentes | 🟢 ✅ |
| `InstallPrompt` (PWA) | Sugestão de instalação | 🟢 ✅ |
| `OfflineIndicator` (PWA) | Toast offline | 🟢 ✅ |

---

## 🎨 Status de Design por Módulo (resumido)

### 🟢 OK — manter / pequenos polish

- **Sidebar desktop + Mobile bottom nav** (KaiSidebar, MobileBottomNav)
- **Login/Signup/NotFound/Offline/NoWorkspacePage** — todas auth pages estão limpas
- **HomeDashboard** (refeito 2026-05-09 + QuickActionCard é template)
- **PlanningBoard + Kanban** (PlanningItemCard, VirtualizedKanbanColumn pós-fix)
- **MetricoolPerformance** (refeito 2026-05-09 com `kai-eyebrow` e tokens corretos)
- **Settings** (navigation agrupada por Conta/Workspace/Sistema)
- **Reference/Content cards** (`references/ReferenceCard.tsx`, `content/ContentCard.tsx`) — templates a reusar
- **Geradores Virais** (Sequence/Reels/Radar) — port literal preserva estética distintiva (paper cream + REC coral + brutalist)
- **CommandPalette + OnboardingFlow + auth pages**
- **NotFound** com Compass animado + auto-redirect

### 🟡 Regular — precisam de polish

| Módulo | Diagnóstico |
|---|---|
| `KaiAssistantTab` | Funciona mas tokens `slate` hardcoded em `CitationChip`/`EnhancedMessageBubble` (P1 audit) — não respeita dark/light com consistência |
| `MetricoolInboxPanel` (1212 linhas) | Master-detail funcional mas sem virtualização; mobile usa Sheet; UI densa, falta hover/focus polish em items list |
| `AutomationsTab` (1262 linhas) | Mistura 3 conceitos (Planning Automations + AI Workflows + Agents) num só lugar — muito denso, falta hierarquia visual |
| `ClientsManagementTool` vs `ClientsListPage` | DUPLICAM função (`tab=clients` e `/kaleidos/clients`). Decidir qual fica |
| `ClientList` | Pós-fix `bg-card`. Falta `focus-visible` no Card todo (a11y) |
| `MyTasksWidget` | Status dots hardcoded `bg-purple-500`/`bg-blue-500` etc — deveriam usar `--status-*` CSS vars (já declaradas em index.css) |
| `VirtualizedKanbanColumn` | Mesmo problema dos status dots hardcoded |
| `ClientEditTabsSimplified` | 9 abas é demais — overflow horizontal só comporta com `whitespace-nowrap` em mobile, hierarquia confusa |
| `ClientNotificationsTab` / `ClientAnalyticsTab` / `ClientMCPTab` | Sub-componentes do edit, design não auditado individualmente |
| `Documentation` (em SettingsTab) | Header com `Back` só faz sentido standalone; em embedded fica órfão |
| `ExportMadureira` | Utility page — sem design |

### 🔴 Bugado — visual quebrado / tokens ruins

| Módulo | Bug |
|---|---|
| `MCPDocsTab` | ~10 tokens `bg-zinc-700/40`, `bg-zinc-950/60`, `text-zinc-300`, etc hardcoded — não respeitam light/dark mode (linhas 77, 229, 265, 284, 289, 344, 387, 391, 395, 423, 461, 475, 517) |
| `RadarSourcesManager` | TikTok pill com `bg-zinc-500/10 text-zinc-600 border-zinc-500/30` :108 — único pill quebrado vs resto do design system |
| `chat/CitationChip` | `reference_library: "bg-slate-500/10 text-slate-600 border-slate-500/20"` :25 — tokens slate sem darkmode |
| `chat/EnhancedMessageBubble` | mesmo bug do CitationChip :72 |

### ⚫ Não testados / faltam

- Páginas órfãs: `JoinWorkspace`, `WorkspaceLogin` (sem rota)
- Sub-tabs de Settings do tipo Workspace/Members/Team/Audit/Integrations/Webhooks — não auditados visualmente
- Sub-tabs de cliente Notifications/Analytics/MCP

---

## ⚙️ Status de Funcionalidade

### ✅ E2E funcionando

- Auth (Login, Signup, redirect, OAuth Google)
- Workspace context + cliente switcher
- HomeDashboard com queries reais
- PlanningBoard (CRUD, drag-drop, calendar, filtros, ClickUp import)
- TeamTasksBoard
- Library per-cliente (content, references, visuals, case studies, reports)
- Viral Sequence + Viral Reels + Viral Radar (ports literais)
- Performance Metricool (todas plataformas)
- Settings (profile, theme, notifications, MCP)
- ClientsManagementTool (CRUD)
- MetricoolInboxPanel (DMs/comments/reviews + reply)
- Automations (planning + AI workflows)
- KAI Assistant (chat per-cliente, citations, pipeline progress)
- GlobalKAIAssistant (botão flutuante)
- CommandPalette (⌘K)
- OnboardingFlow (welcome wizard)
- NotificationBell (mobile)
- 175+ API endpoints em `api/_handlers/`

### ⚠️ Parcial

- **Documentation** — embedded no SettingsTab funciona, mas o componente standalone tem header com Back que duplica navegação
- **Visual Builder** (`automations/visual-builder/`) — só 4 node types (APINode, ConditionNode, PublishNode, WebhookNode) — pode estar incompleto vs os ~175 endpoints disponíveis
- **MCP Docs Tab** — funcional mas tokens visuais quebrados
- **Stripe Billing** — `BillingTab.tsx` existe (componente completo com tiers/tokens/upgrade) mas NÃO está montado em rota nenhuma. Comentário no Kai.tsx diz "KAI 2.0 é uso interno Kaleidos sem cobrança". Código órfão
- **Workspace multi-tenant** — `JoinWorkspace`/`WorkspaceLogin` órfãos, mas Login.tsx ainda tem lógica de slug. App é single-workspace de fato

### ❌ Quebrado / não implementado

- **Páginas órfãs no router**: JoinWorkspace.tsx + WorkspaceLogin.tsx (sem `<Route>` em App.tsx)
- **`tab=mcp` standalone removido** — agora vive em Settings → Sistema → MCP kAI (redirect funciona)
- **`tab=analytics` removido** — redirect pra `performance` (Performance v4 cobre)
- **`tab=billing` removido** — redirect pra `planning`

---

## 📦 Componentes Notáveis (templates a reusar)

1. **`src/components/references/ReferenceCard.tsx`** — Card "biblioteca" perfeito: `memo()`, `useCallback`, `bg-card border-border/60 shadow-sm`, `focus-visible:ring-2`, `tabIndex={0}`, `role="button"`, image fallback robusto
2. **`src/components/content/ContentCard.tsx`** — mesmo padrão
3. **`src/components/planning/PlanningItemCard.tsx`** — pós-fix, com badges + drag visual
4. **`src/components/kai/home/HomeDashboard.tsx:117-145`** — `QuickActionCard` template (focus-visible primary/default states + shadow hover)
5. **`src/components/planning/VirtualizedKanbanColumn.tsx`** — bom uso de `bg-muted/40 dark:bg-muted/20` para coluna kanban (semantic muted, não card transparente)
6. **`src/components/settings/SettingsNavigation.tsx`** — bom agrupamento por section + responsive (vertical desktop, horizontal scroll mobile)
7. **`pages/NotFound.tsx`** — 404 page polida, tokens corretos, animação sutil

---

## 🚧 Faltando (não existe mas deveria)

- ~~404 page~~ ✅ tem
- ~~Empty states~~ ✅ tem `EmptyState` em `ui/empty-state.tsx` + `ClientRequiredEmpty` no Kai.tsx
- ~~Loading skeletons~~ ✅ tem `Skeleton` + `TabLoader` + `PageLoader`
- ~~Confirmation dialogs~~ ✅ tem `AlertDialog` em vários (delete client, delete task)
- ~~Onboarding~~ ✅ tem `OnboardingFlow` com 3 steps
- **Help/docs públicos** — só existe Documentation embedded em Settings. Não há link público
- **Settings de billing/Stripe** — código existe (`BillingTab.tsx`) mas não usado. Decisão arquitetural: KAI é interno = sem billing
- **Multi-language** — só PT-BR. Sem i18n
- **Página de erro genérica** — `ErrorBoundary` tem fallback compact + global, mas sem screenshot/screenshot ou copy de "ops, algo deu errado"
- **Reset de senha standalone** — Login só envia email; falta `/reset-password` page (referenciada em SettingsTab mas não implementada)
- **Configurações de webhooks/notificações por cliente** — existem mas pouco descobertas (escondidas em sub-tabs do edit dialog)
- **Search global** — Cmd+K só navega tabs/clientes; não busca conteúdo. Inputs de search são per-página
- **Audit log visual** — endpoint não confirmado se existe na API
- **Tour guiado pós-onboarding** — só welcome wizard de 3 steps, sem tour das tabs

---

## 💀 Dead Code Suspeito

| Path | Status | Motivo |
|---|---|---|
| `src/components/kai/home/_legacy/` | ⚫ MOVIDO | README confirma: DynamicIdeasSection, HomeDashboardOld, UpcomingContent, WeekHighlights — não importados em nenhum lugar do app. **Pode deletar em ~30 dias** |
| `src/components/billing/BillingTab.tsx` | ⚫ ÓRFÃO | KAI é interno sem billing. Componente nunca montado em rota. Comentário no Kai.tsx confirma |
| `src/pages/JoinWorkspace.tsx` | ⚫ ÓRFÃO | Sem `<Route>`. Multi-tenant signup nunca usado |
| `src/pages/WorkspaceLogin.tsx` | ⚫ ÓRFÃO | Idem |
| `_legacy/performance-tab-apify/` | ⚫ ARQUIVADO | Performance v4 substituiu (CSV+Apify) |
| `_legacy/viral-replaced-2026-05-08/` | ⚫ ARQUIVADO | Tabs viral antigas substituídas pelas ports literais |
| `_legacy/unused-2026-05-09/` | ⚫ ARQUIVADO | Limpeza recente |
| `src/components/kai/KaiAnalyticsTab.tsx` | ⚫ ÓRFÃO | Removido do switch do Kai.tsx em 2026-05-09 (Performance v4 substitui) — arquivo ainda existe |
| `src/components/kai/ViralLibraryTab.tsx` | ⚫ ÓRFÃO | Unificada com KaiLibraryTab em 2026-05-08 |
| `src/components/kai/KaiSettingsTab.tsx` | ⚫ ÓRFÃO | SettingsTab vive em `src/components/settings/`, esse arquivo no kai/ provavelmente é antigo |
| `src/components/metricool/MetricoolCalendarView.tsx` + `MetricoolSmartLinksManager.tsx` + `MetricoolLinkinBioEditor.tsx` | ⚫ ÓRFÃOS | Comentário no Kai.tsx confirma — features dispensadas pelo usuário |
| `src/components/kai/viral-radar/` | ⚫ DADOS apenas | Tem só `niches.ts` + `sources-curated.ts` — usados pela versão `viral-radar-original` |

---

## 📋 Plano de Ação Priorizado

### P0 — Pra essa semana

1. **Resolver duplicação `ClientsManagementTool` vs `ClientsListPage`** — escolher um, remover outro. Decidir se rota `/kaleidos/clients` fica ou se vai tudo pra `?tab=clients`.
2. **Corrigir tokens hardcoded em chat** (P1 do audit ainda não consertado): CitationChip:25, EnhancedMessageBubble:72 — substituir `bg-slate-500/10` por `bg-muted text-muted-foreground border-border`
3. **Corrigir status dots hardcoded** em `VirtualizedKanbanColumn:16-25` e `MyTasksWidget:16-21` — usar `bg-[hsl(var(--status-idea))]` etc (vars já declaradas em `index.css:80-87`)
4. **Corrigir MCPDocsTab** — 10+ tokens zinc hardcoded (linhas 77, 229, 265, 284, 289, 344, 387, 391, 395, 423, 461, 475, 517). Padronizar `bg-muted` / `bg-card`
5. **Acessibilidade ClientList** — Card todo precisa de `focus-visible:ring-2` + `tabIndex={0}` quando vira tap target
6. **Corrigir RadarSourcesManager** :108 — pill TikTok hardcoded zinc
7. **Decidir destino de páginas órfãs** — JoinWorkspace + WorkspaceLogin. Se single-tenant, deletar; se vai voltar a ser multi-tenant, adicionar `<Route>`

### P1 — Próximas 2 semanas

1. **Memos faltando** — `ClientList`, `MyTasksWidget`, extrair `KPICard` em `PerformanceOverview`
2. **Polish AutomationsTab** — separar Planning Automations / AI Workflows / Agents em tabs distintas mais claras (atualmente 3 conceitos numa só tab)
3. **Polish MetricoolInboxPanel** — virtualização da lista de items (quando >50), hover/focus polish
4. **Auditar Settings sub-tabs não verificadas**: Workspace, Members, Team, Audit, Integrations, Webhooks
5. **Decidir destino do BillingTab.tsx** — deletar ou ressuscitar
6. **Search global de conteúdo** — Cmd+K hoje só navega; estender pra buscar items de planning + biblioteca
7. **Polling intervals** — `useTeamTasks` 15s → 30s (consistente com planning)
8. **Documentation embedded fix** — header standalone de `Documentation.tsx` deveria ser condicional ao prop `embedded`
9. **`/reset-password` page** — referenciada mas não implementada

### P2 — Backlog

1. **i18n** — preparar i18next ou similar (todo conteúdo em PT-BR hard-coded)
2. **Tour guiado pós-onboarding** — destacar tabs principais
3. **Padronizar tipografia** — 503 ocorrências de `text-[Npx]`. Já existe utility `.kai-eyebrow` em `index.css:230`. Aplicar em todos os eyebrows
4. **Default Card shadow** — adicionar `shadow-sm` ao default em `ui/card.tsx`
5. **Consolidar `space-y-X` vs `gap-X`** — auditar inconsistências
6. **Hook `useStableQuery`** — wrapper com defaults `staleTime: 30_000, placeholderData: keepPreviousData` aplicado de forma sistemática
7. **Deletar `_legacy/` em `src/components/kai/home/`** após 30 dias (já moved 2026-05-09)
8. **Limpar componentes órfãos** identificados acima (KaiAnalyticsTab, ViralLibraryTab, KaiSettingsTab, Metricool*Calendar/SmartLinks/LinkinBio)
9. **Visual Builder** — completar nodes pra cobrir todos os 175 endpoints (hoje só 4 nodes)

---

## Métricas finais

- **Páginas top-level no router:** 8 ativas + 3 órfãs (JoinWorkspace, WorkspaceLogin, Documentation standalone)
- **Tabs internas Kai.tsx:** 13 ativas (home, assistant, planning, tasks, library, viral-carrossel, viral-reels-page, viral-radar-page, inbox, performance, automations, clients, settings)
- **Sub-sections Settings:** 13 (account×3, workspace×4, system×6)
- **Sub-tabs Cliente Edit:** 9
- **API handlers:** 175+ em `api/_handlers/`
- **Hooks:** 115 (`src/hooks/`)
- **Componentes UI primitives:** 57 (`src/components/ui/`)
- **Migrations DB:** 22 (Neon Postgres)
- **Pastas legadas/arquivadas:** 4 (`_legacy/{performance-tab-apify, unused-2026-05-09, viral-replaced-2026-05-08}` + `kai/home/_legacy`)
- **Bugs visuais P0 restantes:** 0 (audit já consertou os 22 cards `bg-card/50`)
- **Bugs P1 restantes:** ~22 (chat tokens slate + dots hardcoded + MCPDocsTab zinc + RadarSources pill)
- **Componentes órfãos no código:** ~10 (BillingTab, JoinWorkspace, WorkspaceLogin, KaiAnalyticsTab, ViralLibraryTab, KaiSettingsTab, MetricoolCalendarView, MetricoolSmartLinksManager, MetricoolLinkinBioEditor, _legacy home)

---

*Inventário gerado em 2026-05-09. Foco: mapear tudo que existe pra ter um one-stop-shop de "o que tem no app". P0 do design audit anterior já incorporado como baseline.*
