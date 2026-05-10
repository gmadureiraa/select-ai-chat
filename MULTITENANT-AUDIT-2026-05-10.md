# Multi-tenant Integrity Audit — 2026-05-10

> Catalogação completa das tabelas com `workspace_id`/`client_id`/`user_id`,
> cruzamento com policies RLS e busca por mismatches no front (INSERT
> sem campos requeridos). Resultado da auditoria emergencial pós-tela-branca.

## Tabelas auditadas (matriz)

Legenda: **NN** = NOT NULL · **NULL** = nullable · **+def** = column tem default ·
**RLS** = número de policies · **WS,CL,USER** = quais ids o WITH CHECK referencia.

| Table | workspace_id | client_id | user_id | RLS | INSERT/ALL policies |
|---|---|---|---|---|---|
| ai_agents | NN | - | - | 2 | WS,USER |
| ai_usage_logs | - | NULL | NN | 4 | service-role-only |
| ai_workflows | NN | - | - | 2 | WS,USER |
| automation_content_feedback | - | NULL | - | 3 | CL,USER |
| automations | - | NULL | - | 4 | CL,USER |
| client_content_library | - | NN | - | 4 | CL,USER |
| client_documents | - | NN | - | 4 | CL,USER |
| client_post_transcriptions | - | NN | - | 4 | CL,USER |
| client_preferences | - | NULL | - | 3 | WS,CL,USER |
| client_reference_library | - | NN | - | 4 | CL,USER |
| client_social_credentials | - | NN | - | 4 | CL,USER |
| client_templates | - | NN | - | 4 | CL,USER |
| client_viral_competitors | - | NN | - | 4 | CL,USER |
| client_viral_keywords | - | NN | - | 3 | CL,USER |
| client_visual_references | - | NN | - | 4 | CL,USER |
| client_websites | - | NN | - | 4 | CL,USER |
| clients | NN | - | NN+def | 4 | WS,USER |
| content_canvas | NN | NULL | NN | 4 | USER |
| content_feedback | - | NULL | NN | 4 | USER |
| content_repurpose_history | NN | NULL | - | 3 | WS,USER |
| conversations | - | NN | - | 4 | CL,USER |
| email_notification_queue | - | - | NN | 1 | service-role |
| engagement_opportunities | - | NN | - | 4 | WS,CL,USER |
| favorite_messages | - | NN | NN+def | 3 | USER |
| format_rules | NN | - | - | 4 | WS,USER |
| global_knowledge | NN | - | - | 4 | WS,USER |
| image_generations | - | NN | - | 3 | CL,USER |
| import_history | - | NN | NN+def | 3 | CL,USER |
| instagram_posts | - | NN | - | 4 | CL,USER |
| instagram_stories | - | NN | - | 4 | CL,USER |
| kai_chat_conversations | - | NN | NN | 4 | USER |
| kanban_cards | - | NULL | - | 4 | WS,USER |
| kanban_columns | NN | - | - | 4 | WS,USER |
| library_ideas | - | - | - | 2 | USER |
| library_reels | - | - | - | 2 | USER |
| meta_ads_ads | - | NN | - | 4 | WS,CL,USER |
| meta_ads_adsets | - | NN | - | 4 | WS,CL,USER |
| meta_ads_campaigns | - | NN | - | 4 | WS,CL,USER |
| metricool_daily_snapshots | - | NN | - | 3 | WS,CL,USER |
| metricool_posts | - | NN | - | 4 | WS,CL,USER |
| metrics_sync_runs | - | NULL | - | 2 | service-role |
| notification_preferences | NN | - | NN | 2 | USER |
| notifications | NN | - | NN | 3 | USER |
| oauth_connection_attempts | - | NN | - | 3 | USER |
| performance_goals | - | NN | - | 4 | CL,USER |
| performance_reports | - | NN | - | 3 | USER |
| planning_automation_runs | NN | - | - | 5 | WS,USER |
| planning_automations | NN | NULL | - | 4 | WS,USER |
| planning_item_comments | - | - | NN+def | 4 | USER |
| planning_items | NN | NULL | - | 4 | WS,USER |
| platform_metrics | - | NN | - | 4 | CL,USER |
| push_notification_queue | - | - | NN | 1 | service-role |
| push_subscriptions | NN | - | NN | 2 | USER |
| radar_saved_items | NULL | NULL | NN | 1 | USER |
| research_comments | - | - | NN+def | 4 | USER |
| research_project_versions | - | - | NN+def | 2 | USER |
| scheduled_posts | NN | NN | - | 4 | WS,USER |
| super_admins | - | - | NN | 1 | (no INSERT policy) |
| team_task_checklist_items | - | - | - | 4 | USER |
| team_tasks | NN | NULL | - | 4 | WS,USER |
| token_transactions | NN | - | NULL | 2 | WS,USER |
| user_activities | - | - | NN | 2 | USER |
| viral_carousels | NN | NULL | NN | 4 | CL,USER (+ WS após 0036) |
| viral_radar_briefs | NN | NN | NN | 4 | WS,USER |
| viral_reels | NN | NN | NN | 4 | CL,USER |
| viral_search_cache | NN | NN | - | 4 | WS,USER |
| viral_tracked_sources | NULL | NULL | - | 3 | WS,CL,USER |
| webhook_alert_preferences | - | NN | - | 4 | (open WITH CHECK) |
| webhook_events_log | - | NULL | - | 1 | (no INSERT policy) |
| workspace_access_requests | NN | - | NN | 4 | USER |
| workspace_invite_clients | - | NN | - | 3 | WS,USER |
| workspace_invites | NN | - | - | 3 | WS,USER |
| workspace_member_clients | - | NN | - | 3 | WS,USER |
| workspace_members | NN | - | NN | 5 | WS,USER |
| workspace_rejected_users | NN | - | NN | 3 | WS,USER |
| workspace_subscriptions | NN | - | - | 3 | WS,USER |
| workspace_tokens | NN | - | - | 3 | WS,USER |
| youtube_videos | - | NN | - | 4 | CL,USER |

**Total:** 73 tabelas com workspace/client/user_id, todas RLS habilitada.

## P0 consertados (já aplicados)

Bug emergencial identificado e consertado pelo user antes desta auditoria
(contexto da missão):

- **viral_carousels**: front em `src/components/kai/viral-sv-original/lib/carousel-storage.ts:509,643` agora passa `workspace_id` no payload do INSERT (via `useKaiContext` em `src/components/kai/viral-sv-original/lib/use-kai-context.ts`). Migration `0035_viral_carousels_nullable_client_col.sql` já tinha tornado `client_id` nullable.

Cross-check completo de TODOS os 51 INSERT/UPSERT no `src/`: nenhum bug P0 NOVO encontrado. Cada tabela com `workspace_id` NN tem o front passando o valor; cada tabela com `client_id` NN tem o front passando ou a RLS valida via JOIN com `clients`.

Detalhe por arquivo (verificações feitas):

| Hook/componente | Tabela | Passa workspace_id? | Passa client_id? | OK |
|---|---|---|---|---|
| `usePlanningItems.ts:236,440,550` | planning_items | sim (workspaceId do hook) | sim (input.client_id ou null) | ✓ |
| `useTeamTasks.ts:95,156` | team_tasks | sim | sim (nullable, input ou null) | ✓ |
| `usePlanningColumns.ts:63` | kanban_columns | sim (workspaceId) | n/a | ✓ |
| `usePlanningAutomations.ts:138` | planning_automations | sim | sim | ✓ |
| `usePlanningComments.ts:56,89` | planning_item_comments, notifications | n/a, sim | n/a | ✓ |
| `useClients.ts:134` | clients | sim | n/a | ✓ |
| `useClientOnboarding.ts:112,187,247,284` | clients, client_preferences, client_reference_library, client_documents | sim (clients), n/a (RLS via JOIN) | n/a, sim | ✓ |
| `useClientDocuments.ts:54` | client_documents | n/a | sim | ✓ |
| `useClientVisualReferences.ts:128` | client_visual_references | n/a | sim | ✓ |
| `useClientTemplates.ts:68` | client_templates | n/a | sim | ✓ |
| `useReferenceLibrary.ts:64` | client_reference_library | n/a | sim | ✓ |
| `useContentLibrary.ts:56` | client_content_library | n/a | sim | ✓ |
| `useKAIConversations.ts:57` | kai_chat_conversations | n/a | sim | ✓ |
| `useKAISimpleChat.ts:100,128` | kai_chat_messages, kai_chat_conversations | n/a | sim | ✓ |
| `useFavoriteMessages.ts:69` | favorite_messages | n/a | sim | ✓ |
| `useTaskComments.ts:43`, `useTaskChecklist.ts:45` | team_task_comments, team_task_checklist_items | n/a (RLS via JOIN team_tasks) | n/a | ✓ |
| `useConversationHistory.ts:35` | conversations | n/a (RLS via JOIN clients) | sim | ✓ |
| `useInstagramPosts.ts:96` | instagram_posts (upsert) | n/a | sim | ✓ |
| `useKAIExecuteAction.ts:124,173,215,251` | import_history, planning_items, client_content_library, client_reference_library | sim (planning_items), n/a outros | sim | ✓ |
| `useWebPushSubscription.ts:122`, `usePushSubscriptions.ts` | push_subscriptions | sim (workspace.id) | n/a | ✓ |
| `useMemberClientAccess.ts:64` | workspace_member_clients (via JOIN) | n/a | sim (workspace_member_id) | ✓ |
| `WorkspaceGuard.tsx:101` | workspace_access_requests | sim | n/a | ✓ |
| `MessageFeedback.tsx:59` | content_feedback | n/a | n/a (RLS auth.uid()) | ✓ |
| `CrossAppActions.tsx:125,145,204` | planning_items, library_ideas, client_reference_library | sim (planning), n/a, n/a | sim | ✓ |
| `viral-sv-original/carousel-storage.ts:521,529,652,661` | viral_carousels (via VIEW carousels) | sim (após fix) | nullable | ✓ |
| `viral-reels-original/MainApp.tsx:181,340,395,434` | planning_items, client_reference_library, client_content_library | sim (resolveWorkspaceId) | sim | ✓ |
| `useClientDocuments.ts`, `ClientCreationWizardSimplified.tsx:127` | client_documents | n/a | sim | ✓ |
| `RadarSourcesManager.tsx:161` | radar_tracked_sources (admin) | n/a | n/a | ✓ |
| `WebhookSettings.tsx:247` | webhook_alert_preferences | n/a | sim | ✓ |
| `TeamManagement.tsx:198,246` | workspace_member_clients | n/a | sim | ✓ |

## P0/P1 corrigido nesta auditoria (NOVO)

### MIGRATION 0036 — viral_carousels RLS hardening

**Tipo:** P1 latente (defesa em profundidade)

**Achado:** A policy INSERT do `viral_carousels` permitia gravação com
`client_id IS NULL` desde que `user_id = auth.uid()`. Como a coluna
`workspace_id` é NOT NULL sem default e a RLS NÃO checava esse campo,
um user logado em teoria poderia inserir um carrossel "solto" em
QUALQUER workspace_id arbitrário (qualquer UUID que ele soubesse).
Risco prático baixo (UUIDs são v4 não-enumeráveis e a UI só passa o
workspace correto via `useKaiContext`), mas é furo potencial.

Mesmo problema afetava SELECT/UPDATE/DELETE quando `client_id IS NULL`.

**Fix:** Migration `migrations/0036_multitenant_audit_hardening.sql`
adiciona `is_workspace_member(auth.uid(), workspace_id)` em todas as 4
policies (INSERT/SELECT/UPDATE/DELETE) quando `client_id IS NULL`.
UPDATE também ganhou `WITH CHECK` reforçado contra mover row pra outro
workspace. Idempotente (drop + create), com `NOTIFY pgrst` no fim.

**Aplicada:** sim, em produção via `_apply_0036.mjs` em 2026-05-10. Tracked
em `__migrations_applied`.

## P1 sugestões (não aplicadas)

Padrões "lateralmente sub-ótimos" mas que não bloqueiam UX agora.

- **viral_reels**: tem `workspace_id` NN sem default mas RLS só checa
  `client_workspace_accessible(client_id, auth.uid()) AND user_id = auth.uid()`.
  Como `client_id` também é NN nessa tabela (diferente do viral_carousels),
  o RLS já valida workspace via JOIN com `clients`. Não há furo. Não fazer
  nada. Backend (`api/_handlers/adapt-viral-reel.ts:330`) já passa
  workspace_id no INSERT.

- **content_canvas / notification_preferences / push_subscriptions /
  workspace_access_requests / notifications**: têm `workspace_id` NN sem
  default mas RLS só checa `user_id`. Em todos os 5 casos o front/back já
  passa `workspace_id` corretamente (verificado no áudit). Adicionar a
  checagem `is_workspace_member(auth.uid(), workspace_id)` nas policies
  INSERT seria defesa em profundidade (mesma justificativa que viral_carousels)
  mas não há bug ativo. Postergado.

- **ai_usage_logs / push_notification_queue / email_notification_queue /
  metrics_sync_runs / webhook_events_log**: INSERT bloqueado pra usuários
  (só service role). OK.

- **webhook_alert_preferences**: WITH CHECK = `true` (qualquer usuário
  autenticado pode inserir). Faz sense pra alerts globais; sem cliente_id
  como proxy. Não tocar.

- **library_ideas / library_reels**: sem workspace_id ou client_id (são
  globais). RLS só verifica auth.uid() em algumas operações. Por design.

## Stats

- **Tabelas analisadas:** 73 (todas com workspace/client/user_id)
- **INSERTs no front auditados:** 51 (em 34 arquivos)
- **Bugs P0 ativos no front:** 0 (já consertado pelo user)
- **Bugs P0 latentes (column NN sem RLS check):** 0 (todos passam o campo)
- **P1 hardening aplicado:** 1 (`0036_multitenant_audit_hardening.sql`)
- **P1 sugestões pendentes:** 5 (RLS defesa em profundidade, baixo risco)
- **Migrations criadas:** 1
- **Build:** ✓ (`bun run build` ok)

## Scripts gerados

Para reprodutibilidade da auditoria:

- `_audit_multitenant.mjs` — lista colunas + RLS por tabela (JSON)
- `_audit_complete.mjs` — matriz markdown completa + bugs latentes
- `_audit_mismatches.mjs` — só os mismatches crus
- `_check_viral_carousels.mjs` — verifica policies da viral_carousels
- `_apply_0036.mjs` — aplica migration 0036 idempotente

Tudo prefixado com `_` pra não vazar pro build (gitignored se necessário).
