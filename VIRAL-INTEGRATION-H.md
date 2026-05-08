# VIRAL-INTEGRATION-H — Analytics & Insights

Fase H executada em 2026-05-08 na branch `combo-viral-integration` (sem commit).
Plano completo em `VIRAL-INTEGRATION-PLAN.md`.

## Objetivo

Plugar analytics dos pipelines virais (carrosséis, reels, briefs Radar) no
Home dashboard e no detalhe de cada cliente, sem mexer em código de outras
fases (E lida com cron handlers, G mexe em ClientContextDrawer/Header).

## Files criados

### Backend (Vercel Functions)

- `api/_handlers/viral-stats.ts`
  Handler `authedPost` que recebe `{ workspace_id, client_id?, range }` e
  retorna agregados de:
    - `viral_carousels` (total, published, draft, this_period)
    - `viral_reels` (total, this_period)
    - `viral_radar_briefs` (total, this_period)
    - `workspace_tokens` (quota, used, remaining, balance)
    - `planning_items` (ideas, drafts, scheduled, published_total/this_period)
  Cada subquery é safe (try/catch retorna zeros) seguindo o padrão de
  `radar-admin-stats.ts`. Range aceita `7d` / `30d` / `90d` e é passado como
  intervalo parametrizado pra evitar SQL injection.

### Hooks

- `src/hooks/useViralStats.ts`
  Wrapper de `useQuery` em cima de `apiInvoke('viral-stats', ...)`.
  Resolve workspace via `useWorkspace()`. Chave inclui workspace_id +
  client_id + range. `staleTime: 60_000`.

- `src/hooks/useTopViralContent.ts`
  Lê da materialized view `client_top_content` (criada em migration 0011)
  via Supabase REST. Ordena por `rank` ASC. `staleTime: 5min`.
  Cast com `(supabase as any)` porque a view não está no types.ts gerado.

### Components Home

- `src/components/kai/home/ViralStatsCard.tsx`
  Card com 4 células (Carrosséis, Reels, Briefs, Tokens) clicáveis. Cada
  célula navega via `onNavigate` pra tab correspondente
  (`viral-carrossel`, `viral-reels-page`, `viral-radar-page`, `billing`).
  Usa skeleton fiel ao layout final pra evitar flash.

- `src/components/kai/home/TopViralContentCard.tsx`
  Top 5 conteúdos do cliente ranqueados por engagement. Aparece só com
  `clientId` definido. Empty state instrui a importar histórico em
  Settings > Library. Click no item abre URL externa (metadata.url) ou
  chama `onItemClick`.

### Components Cliente

- `src/components/clients/ClientAnalyticsTab.tsx`
  Aba "Analytics" do detalhe de cliente. Composta por 5 cards:
    1. Stats virais 30d (4 KPIs)
    2. Bar chart criação de planning_items por mês (recharts, últimos 6m)
    3. Top 10 conteúdo (`useTopViralContent` com limit 10)
    4. Tokens consumidos por feature — heurística sobre
       `token_transactions.description` + `metadata` (carousel/reel/brief/other).
       Inclui aviso explícito que tokens são workspace-level (não per-client).
    5. Atividade recente filtrada por `entity_name` ou `description`
       contendo o nome/id do cliente.

## Components plugados

- `src/components/kai/home/HomeDashboard.tsx`
  Adicionado `<ViralStatsCard onNavigate={onNavigate} range="30d" />` logo
  após `<WorkspaceStatsCards />`. Adicionado `<TopViralContentCard />` no
  fim do dashboard usando `stats.byClient[0]?.clientId` (cliente com mais
  atividade no pipeline) — solução pragmática já que HomeDashboard é
  workspace-wide e não tem cliente selecionado.

- `src/components/clients/ClientEditTabsSimplified.tsx`
  Adicionada tab "Analytics" como 6ª (ícone `BarChart3`). TabsList agora é
  `grid-cols-6`. Renderiza `<ClientAnalyticsTab clientId={client.id} />`.

## Tabela de tabelas usadas

| Tabela / View              | Usada em                | Filtro              |
|----------------------------|-------------------------|---------------------|
| viral_carousels            | viral-stats handler     | workspace + client  |
| viral_reels                | viral-stats handler     | workspace + client  |
| viral_radar_briefs         | viral-stats handler     | workspace + client  |
| workspace_tokens           | viral-stats handler     | workspace           |
| planning_items             | viral-stats + chart     | workspace + client  |
| client_top_content (view)  | useTopViralContent      | client              |
| token_transactions         | ClientAnalyticsTab      | workspace + amount<0|
| user_activities            | ClientAnalyticsTab      | user + filtro nome  |
| clients                    | ClientAnalyticsTab      | id                  |

## Build status

`bun run build` passa em 10s — sem erros TS, todos os bundles gerados.
Tipo do handler isolado também passa em `tsc --noEmit`.

`api/handler-manifest.ts` regenerado com 118 entries incluindo `viral-stats`.

## Decisões de design

1. **Workspace-wide por padrão no Home**: respeitamos o comentário existente
   `// Note: Home is intentionally workspace-wide (never filters by client)`.
   ViralStatsCard sempre mostra agregados do workspace. Pra mostrar Top
   Content do cliente, usamos heurística (cliente com mais pipeline), que
   evita adicionar selectedClientId só pro Home.

2. **Tokens são workspace-level**: deixamos isso explícito no aviso na
   ClientAnalyticsTab porque `token_transactions` não tem `client_id`.
   Heurística por feature usa string match em description + metadata —
   simples e robusto enquanto não adicionamos `feature_tag` na tabela.

3. **Atividade recente filtrada via string match**: `user_activities` é
   user-scoped. Filtramos por `entity_name` ou `description` contendo o
   nome/id do cliente. Fallback pras 5 últimas se nada bater. Pode ser
   substituído por filtro estruturado quando `client_id` for adicionado.

4. **Evitamos refazer roteamento no card**: usamos o callback `onNavigate`
   já existente (que muda `?tab=...`). Não importamos `useNavigate` direto
   pra manter alinhamento com Home (que centraliza navegação).

## NÃO foi feito (por design / fora do escopo)

- Nenhuma mudança em `viral-radar-original/*` (FASE-E)
- Nenhuma mudança em `src/components/kai/viral/*` (FASE-G)
- Nada em billing/ (já existe e Tokens só linkam pra lá)
- Nenhum commit feito

## Critério pronto — checklist

- [x] Handler `viral-stats` criado e funcional
- [x] Hooks `useViralStats` + `useTopViralContent`
- [x] `ViralStatsCard` + `TopViralContentCard` no HomeDashboard
- [x] `ClientAnalyticsTab` plugado em ClientEditTabsSimplified como 6ª tab
- [x] `bun run build` passa
- [x] Documentação criada em `VIRAL-INTEGRATION-H.md`
- [x] `handler-manifest.ts` regenerado
