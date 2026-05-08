# HomeDashboard — Melhorias

Documentação das seções adicionadas ao `HomeDashboard` em `src/components/kai/home/`.

## Resumo

Antes: o dashboard tinha greeting, tarefas internas, KPI Row (4 cards de pipeline), Today/Overdue, Pipeline, Clientes, Plataformas, Weekly Timeline.

Agora foram adicionados 4 widgets novos para fechar lacunas de:
- visibilidade de saúde do workspace (clientes ativos, tokens)
- atalhos para criar conteúdo
- atividade recente do usuário
- destaques do radar viral

A KPI Row e seções legadas foram **mantidas intactas** porque tinham filtros úteis acoplados ao pipeline.

---

## Novos componentes

### 1. `WorkspaceStatsCards.tsx`

4 cards de saúde do workspace, posicionados logo abaixo do greeting.

| Card | Métrica | Query |
|---|---|---|
| Clientes ativos | nº de clients com `planning_items.updated_at` nos últimos 30d, sobre total | `planning_items` distinct `client_id` |
| Agendados (7d) | posts com `scheduled_at` entre hoje e +7d, status pendente | `count(*)` |
| Publicados este mês | `status = 'published'` no mês atual + comparativo com mês anterior | 2 counts paralelos |
| Tokens disponíveis | `workspace_tokens.balance` + barra de uso vs allowance do plano + período de renovação | já no `WorkspaceContext` |

- Cada card tem trend indicator (TrendingUp/Down/flat) quando aplicável.
- Card de tokens tem `Progress` colorido conforme % usado (vermelho >=80%, laranja >=50%).
- Click dispara `onNavigate` para a aba relevante (`clients`, `planning`, `billing`).
- Skeleton loader por card (não bloqueia o resto do dashboard).

### 2. `QuickActions.tsx`

Grid 2x4 (mobile: 2 colunas, desktop: 4) com atalhos para os principais fluxos:

- Criar carrossel → `viral-carrossel`
- Roteiro de reel → `viral-reels-page`
- Abrir radar → `viral-radar-page`
- Biblioteca viral → `viral-library`
- Planejamento → `planning`
- Novo cliente → `clients` (ou callback custom)
- Automações → `automations`
- Convidar membro → `workspace-members`

Cada botão tem ícone colorido com bg suave + label + descrição curta.

### 3. `RecentActivity.tsx`

Top 10 `user_activities` ordenados por `created_at` desc, filtrados pelo `user_id` atual.

- Cada linha: ícone (mapeado por `activity_type`), descrição + entity_name, timestamp relativo (date-fns ptBR).
- Mapa de ícones cobre todos os 22 valores do enum `activity_type` (client/template/automation/image/etc).
- Empty state: ícone Clock + mensagem "Sem atividade recente".
- Skeleton loader durante fetch.
- `staleTime: 30s`, sem polling.

### 4. `RadarHighlights.tsx`

Top 5 `viral_radar_briefs` com `status='done'` dos clientes do workspace atual.

- Filtra por `client_id IN (workspace clients)` já que a tabela não tem `workspace_id`.
- Mostra: ícone Flame, primeiro hook/topic, nome do cliente, timestamp relativo, badge com nº total de ideias (hot_topics + carousel_ideas).
- Click → `onNavigate("viral-radar-page")`.
- Empty state com CTA "Abrir radar".
- Header tem total de ideias agregadas + botão "Abrir radar".
- `staleTime: 60s`.

---

## Layout final do `HomeDashboard.tsx`

Ordem das seções:

1. Header (greeting + data + CTA "Ver planejamento")
2. Active filter indicator (existente)
3. **WorkspaceStatsCards** (novo) — 4 cols
4. **QuickActions** (novo) — 4 cols
5. MyTasksWidget (existente)
6. KPI Row (atrasados/hoje/semana/publicados — com filtros)
7. Filtered results panel (existente)
8. Main grid: Overdue + Today + Recent Published / Pipeline + Clients + Platforms (existente)
9. **Atividade recente + Radar viral** (novo) — 2 cols (1 col mobile)
10. Weekly timeline (existente)

## Performance

- Todas queries usam TanStack Query com `staleTime` 30-60s — sem polling agressivo.
- Cards do `WorkspaceStatsCards` rodam queries em paralelo (publicados é `Promise.all` interno).
- Skeleton loaders por widget — falhas de uma query não derrubam o resto.
- `HomeDashboard` continua sendo lazy-loaded em `Kai.tsx`.

## Mobile-first

- Stats cards: 2 cols mobile, 4 cols desktop.
- Quick Actions: 2 cols mobile, 4 cols desktop.
- Recent Activity / Radar Highlights: stack vertical mobile, 2 cols desktop.

## Convenções respeitadas

- `import { supabase } from "@/integrations/supabase/client"`
- `useWorkspaceContext` (já existe, usa `useWorkspace` apenas em hooks específicos)
- date-fns + `ptBR` em tudo
- Lucide icons
- shadcn/ui (Card, Badge, Button, Progress, Skeleton)
- Framer-motion `initial/animate` para entrada suave

## Build status

- `bun run build` ✅ ok (HomeDashboard chunk: 37.38 kB / gzip 9.75 kB)
- `bunx tsc --noEmit` ✅ clean
