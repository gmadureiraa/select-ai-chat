# Home — componentes legacy

Movidos em 2026-05-09 (auditoria HOME tab) por já não serem importados em
nenhum lugar do app:

- `DynamicIdeasSection.tsx` — usava `useTopPerformingContent` + `instagram_posts`,
  hoje substituído pelo `TopViralContentCard` (lê `client_top_content` MVIEW).
- `WeekHighlights.tsx` — lia `instagram_posts` direto. Substituído por
  Performance v4 (Metricool) + `WorkspaceStatsCards`.
- `UpcomingContent.tsx` — lia `kanban_cards` antigo (era do PlanningBoard v1).
  Hoje os próximos itens vivem no `HomeDashboard` (cards Hoje / Atrasados /
  Semana) lendo `planning_items`.

Manter aqui só pra referência histórica. Pode ser deletado se nada novo
referenciar em ~30 dias.
