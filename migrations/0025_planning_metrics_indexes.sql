-- 0025_planning_metrics_indexes.sql
-- Indexes pra acelerar queries do cron-fetch-published-metrics e do hook
-- useFindPlanningByMetricoolPostId. Documenta key `metrics` em metadata.
--
-- Aplicação: idempotente.

-- Acelera o filtro do cron (status=published + filtra por metrics_synced_at)
CREATE INDEX IF NOT EXISTS idx_planning_items_metrics_synced
  ON planning_items ((metadata->>'metrics_synced_at'))
  WHERE status = 'published';

-- Lookup direto por external_post_id (link bidirecional Metricool → planning)
CREATE INDEX IF NOT EXISTS idx_planning_items_external_post
  ON planning_items (external_post_id)
  WHERE external_post_id IS NOT NULL;

-- Lookup por metricool_post_id em metadata (caso external_post_id esteja vazio
-- mas o id real esteja no jsonb — acontece em items legados)
CREATE INDEX IF NOT EXISTS idx_planning_items_metricool_post_id
  ON planning_items ((metadata->>'metricool_post_id'))
  WHERE metadata->>'metricool_post_id' IS NOT NULL;

COMMENT ON COLUMN planning_items.metadata IS
  'jsonb opaco. Chaves conhecidas: provider (metricool|postiz|late), metricool_post_id, metricool_blog_id, target_platforms, platform_options, thread_tweets, content_type, viral_carousel_id, viral_carousel_slides, providers_status, metricool_state, metricool_synced_at, published_url, metrics ({likes, comments, shares, reach, impressions, video_views, saves, eng_rate, last_synced_at}), metrics_synced_at';
