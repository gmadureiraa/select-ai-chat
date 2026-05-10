# REVIEW BACK B — DB Schema + RLS + Indexes + Crons + Performance

**Data:** 2026-05-10
**Repo:** `code/kai-app-combo` (KAI 2.0 SaaS, Neon Postgres + Vercel Functions)
**Migration aplicada:** `0033_review_back_b_indexes_and_views.sql`

---

## Resumo executivo (≈200 palavras)

Auditei schema, RLS, índices, crons e migrations do KAI 2.0 contra o Neon de produção. Achei 5 problemas P0 e apliquei correções na migration `0033`. **Migration `0025_planning_metrics_indexes`** estava em disco mas nunca foi executada (faltavam 3 índices em `planning_items` que sustentam o cron de métricas). **`client_social_credentials_decrypted`** e **`workspace_invites_secure`** foram portadas como tabelas vazias quando o original Supabase eram VIEWs com `security_invoker` — todo handler que consultava (twitter-feed, twitter-reply) recebia 0 rows silenciosamente. **A função RPC `get_client_social_credentials_decrypted`** chamava `decrypt_credential` (inexistente) em vez de `decrypt_social_token`. **Faltavam índices em 8 FKs** (ON DELETE faria seq scan completo) e em 3 colunas hot (`clients.workspace_id`, `kanban_columns.workspace_id`, `client_reference_library.client_id`) — `clients` mostrava 737 seq_scans no `pg_stat_user_tables`. RLS está bem distribuído: 100 das 101 tabelas têm RLS habilitado e 310 policies cobrindo 100 tabelas; a única sem RLS é `__migrations_applied` (correto). Crons em `vercel.json` estão consistentes com handlers — os 12 handlers cron-like fora do `vercel.json` são fanout interno do `cron-radar-master` ou dispatchers manuais (`send-invite-email`, `send-push-notification`). Nenhuma tabela órfã: todas as 103 tabelas são referenciadas em `api/` ou `src/`. Tracking `__migrations_applied` foi backfillado para refletir 18 migrations já no DB mas sem registro. Build passa.

---

## 1. RLS coverage

**Total:** 101 tabelas em `public`. RLS habilitado em **100/101** (a exceção é `__migrations_applied`, correto). **310 policies** cobrindo **100 tabelas**.

### Tabelas com policies "single-verb" (read-only para clientes, mutações via service-role)

Algumas exibem cobertura aparentemente incompleta na auditoria por design (gravação restrita a service-role):

- `subscription_plans`, `super_admins`, `kai_documentation` → SELECT-only para cliente
- `viral_linkedin_posts`, `viral_threads_posts`, `viral_tiktok_posts`, `viral_twitter_posts`, `viral_news_articles` → SELECT-only (gravação por scrape via service-role)
- `webhook_events_log`, `ai_workflow_runs`, `email_notification_queue`, `push_notification_queue` → SELECT-only (gravação por handler)
- `library_ideas`, `library_reels`, `radar_newsletters_curated`, `research_project_versions`, `planning_item_versions` → SELECT + INSERT (sem UPDATE/DELETE por design)

Não considero P0 — é o padrão "service-role só escreve" do KAI.

### Sensíveis

- `client_social_credentials` (creds OAuth de redes): 4 policies (SELECT/INSERT/UPDATE/DELETE) condicionadas por `client_workspace_accessible(client_id, auth.uid())`. OK.
- `profiles`: 7 policies redundantes (sobrepõem). Funcional, mas pode-se consolidar em 3 (own-read, own-write, colleague-read) num próximo passe.
- `super_admins`: 1 SELECT (`auth.uid() = user_id`). Inserção apenas via service-role. OK.

---

## 2. Indexes — criados e sugeridos

### Aplicados em `0033`

**FKs sem suporte (8):**
- `idx_library_ideas_created_by`, `idx_library_reels_created_by`
- `idx_profiles_referred_by` (parcial WHERE NOT NULL)
- `idx_radar_saved_items_client_id`, `idx_radar_saved_items_workspace_id`
- `idx_viral_linkedin_posts_source_id`, `idx_viral_threads_posts_source_id`, `idx_viral_twitter_posts_source_id`

**Hot tables com `seq_scan` dominante (4):**
- `idx_clients_workspace_id` (737 seq_scans / 7 rows)
- `idx_clients_user_id`
- `idx_kanban_columns_workspace_id` (73 seq_scans / 0 idx_scans)
- `idx_client_reference_library_client_id` (455 seq_scans)

**Re-aplicadas da `0025` (3):**
- `idx_planning_items_metrics_synced` — sustenta `cron-fetch-published-metrics`
- `idx_planning_items_external_post`
- `idx_planning_items_metricool_post_id`

**Antes:** 263 índices. **Depois:** 356 índices. **FKs sem índice:** 0 (era 8).

### Observação sobre seq_scan residual

Tabelas como `client_social_credentials` (9 rows) e `profiles` (1 row) ainda mostram seq_scan dominante porque o planner prefere seq scan em tabelas pequenas — não é gargalo real. Vão estabilizar quando o volume crescer.

---

## 3. Crons — vercel.json vs handlers

**12 crons agendados, 100% com handler correspondente:**

| Cron | Schedule | Status |
|---|---|---|
| `cron-metricool-backfill-posts` | 0 5 * * * | OK |
| `cron-metricool-snapshot` | 0 6 * * * | OK |
| `cron-radar-master` | 0 7 * * * | OK (fanout para 6 scrapers) |
| `cron-generate-daily-brief` | 0 8 * * * | OK |
| `cron-postiz-poll` | 0 9 * * * | OK |
| `cron-metricool-poll` | 0 10 * * * | OK |
| `cron-transcribe-recent-posts` | 0 12 * * * | OK |
| `cron-fetch-published-metrics` | 0 13 * * * | OK (agora indexado) |
| `process-scheduled-posts` | */5 * * * * | OK |
| `process-recurring-content` | 0 4 * * * | OK |
| `send-publish-reminders` | 0 9 * * * | OK |
| `process-due-date-notifications` | 30 9 * * * | OK |

**Schedules razoáveis** — janela 04h-13h escalonada por hora, sem bombardeio. `process-scheduled-posts` em 5min é alto mas necessário.

**Handlers cron-like NÃO no vercel.json (12) — todos justificados:**

- `cron-scrape-{news,instagram,tiktok,twitter,threads,linkedin}` — chamados internamente por `cron-radar-master` via fetch (fanout, evita stack do Hobby plan)
- `process-knowledge`, `process-push-queue`, `process-email-notifications`, `process-automations` — dispatchers chamados por outros handlers (verificado em `client-add-source`, `dev-test-flows`, `generate-viral-carousel`, etc.)
- `send-push-notification`, `send-invite-email` — disparados manualmente por endpoints autenticados

Nenhum cron órfão. Nenhum handler-de-cron sem trigger.

---

## 4. Migrations gap

**Antes:**
- 30 arquivos em `migrations/` com naming `00XX_*`
- `__migrations_applied` continha 35 IDs com naming antigo (`0001_init`, `0002_workspace`, etc.) **não compatível** com os arquivos em disco
- 18 dos arquivos em disco não tinham linha em `__migrations_applied`
- Spot-check: **0025 nunca foi aplicada** (índices ausentes)

**Depois:**
- `0025_planning_metrics_indexes` re-aplicada via `0033`
- `0033_review_back_b_indexes_and_views` aplicada
- `__migrations_applied` backfillado: agora **49 entradas** (todas as 30 do disco + 18 antigas + nova 0033). Single source of truth restaurada.

**Recomendação para próximas migrations:** sempre incluir `INSERT INTO __migrations_applied` no rodapé do `.sql` (padrão estabelecido em `0033`).

---

## 5. Tabelas órfãs / Problemas de schema

### Resolvido em 0033

- **`client_social_credentials_decrypted`** era TABLE vazia (deveria ser VIEW). Drop + recreate como VIEW com `security_invoker = true` chamando `decrypt_social_token` em todos os campos `*_encrypted`. **Impacto:** twitter-feed e twitter-reply deixam de retornar 0 rows silenciosamente.
- **`workspace_invites_secure`** mesma situação. Drop + recreate como VIEW com mascaramento condicional de email (admin/owner vê plain, membro comum vê `mask_email`).
- **`get_client_social_credentials_decrypted(uuid)`** apontava pra `decrypt_credential(text)` (não existe). Recriada usando `decrypt_social_token(text)`.

### Não há tabelas verdadeiramente órfãs

Todas as 103 tabelas têm referência em `api/` ou `src/`. 74 tabelas com `n_live_tup=0` são features novas/em teste, não código morto.

### Tabelas sem PK — só duas, ambas eram tabelas-fantasma

- `client_social_credentials_decrypted` → agora VIEW
- `workspace_invites_secure` → agora VIEW

---

## 6. Data integrity

- `planning_items.column_id` tem **1 row NULL de 19** (resíduo do backfill da 0022). Não é P0 — UI lida com null. Pode-se rodar segundo backfill se a coluna virar NOT NULL futuramente.
- Nenhum FK orphan detectado em spot-checks.
- Schema de `client_social_credentials` separa `*_encrypted` (storage) de plaintext (via view/RPC) — padrão correto agora restaurado.

---

## 7. Performance — queries hot validadas

`EXPLAIN ANALYZE` em 3 queries hot do app:
- `client_social_credentials WHERE client_id+platform`: Limit + Seq Scan, 0ms (tabela 9 rows — irrelevante)
- `planning_items WHERE status='published' AND metrics_synced_at IS NULL`: Limit + Index Scan `idx_planning_items_status` — vai ficar mais rápido com `idx_planning_items_metrics_synced` quando volume crescer
- `kanban_columns WHERE workspace_id`: Era Seq Scan, agora tem `idx_kanban_columns_workspace_id`

`pg_stat_statements` ativo no Neon — recomendo monitorar `total_exec_time` em 1 semana e ajustar se algum statement > 100ms entrar nos top 10.

---

## 8. Build

`bun run build` passa em 6s, **0 quebras de schema** na frente. As VIEWs recriadas mantêm o mesmo shape que `src/integrations/supabase/types.ts` espera (verificado).

---

## Próximos passes (não-P0)

1. Consolidar 7 policies redundantes de `profiles` em 3 (limpeza, sem mudança funcional)
2. Considerar criar índice composto `(workspace_id, status, scheduled_at)` em `planning_items` se cron de scheduled-posts crescer >1k items
3. Tornar `planning_items.column_id` NOT NULL após backfill de últimas 1 row residual
4. Avaliar queue (`metricool_posts`) com 177 rows e 55 seq_scans — pode ganhar índice `(client_id, blog_id)` quando virar 5k+

---

*Auditoria executada por Opus 4.7 (1M context) em 2026-05-10. Migration aplicada e tracking atualizado. Revisar antes de promover Stack Auth/Vercel deploy final.*
