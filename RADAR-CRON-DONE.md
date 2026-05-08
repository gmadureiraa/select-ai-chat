# Radar Cron — Migração Completa

> Branch: `combo-viral-integration` (NÃO commitada)
> Data: 2026-05-07
> Agente: RADAR-CRON

## Resumo

Portado o cron próprio do Radar Viral standalone (`code/radar-viral/`) pra dentro do KAI 2.0. KAI agora consegue popular o DB com news/IG/TikTok/briefs sem depender do app v1 legacy.

## Parte 1 — Tabelas DB

### Já existiam
- `viral_carousels`
- `viral_radar_briefs` (schema multi-tenant: client_id+workspace_id+user_id NOT NULL)
- `viral_reels`
- `viral_search_cache`

### Criadas via `migrations/0003_radar_full.sql`
- `viral_tracked_sources` — fontes monitoradas (rss/instagram/tiktok/youtube/twitter/newsletter), pode ter `client_id`/`workspace_id` ou ser global
- `viral_news_articles` — artigos RSS scrapeados (UNIQUE em url)
- `viral_tiktok_posts` — posts TikTok (UNIQUE em shortcode)

Aplicada com sucesso no Neon. RLS habilitado, policies de leitura pública (escrita só via service-role).

Verificação:
```
$PSQL "$NEON_URL" -c "\dt public.viral_*"
                    List of tables
 Schema |         Name          | Type  |    Owner
--------+-----------------------+-------+--------------
 public | viral_carousels       | table | neondb_owner
 public | viral_news_articles   | table | neondb_owner   ← NOVO
 public | viral_radar_briefs    | table | neondb_owner
 public | viral_reels           | table | neondb_owner
 public | viral_search_cache    | table | neondb_owner
 public | viral_tiktok_posts    | table | neondb_owner   ← NOVO
 public | viral_tracked_sources | table | neondb_owner   ← NOVO
```

## Parte 2 — Handlers criados

Pattern compartilhado: `req.headers['x-vercel-cron'] === '1'` OU `Bearer $CRON_SECRET`. Sem auth de user.

| Handler | LOC | Função |
|---------|-----|--------|
| `api/_handlers/cron-scrape-news.ts` | 251 | Lê fontes RSS, parse XML (fallback rss2json), UPSERT em `viral_news_articles` por url |
| `api/_handlers/cron-scrape-tiktok.ts` | 197 | Apify `clockworks/tiktok-scraper`, UPSERT em `viral_tiktok_posts` por shortcode. Gated por `RADAR_TIKTOK_CRON_ENABLED=1` (custo) |
| `api/_handlers/cron-scrape-instagram.ts` | 234 | Apify `apify~instagram-scraper`, UPSERT em `instagram_posts` por (client_id, post_id). Gated por `RADAR_IG_CRON_ENABLED=1` |
| `api/_handlers/cron-generate-daily-brief.ts` | 296 | Agrega 24h de news + IG + TikTok por client, gera brief via Gemini 2.5 Flash, INSERT em `viral_radar_briefs`. Idempotente (1 brief por client por dia) |

### Convenções seguidas
- ESM `.js` extension nos imports
- `import { query, queryOne } from '../_lib/db.js'`
- `applyCors`, `handlePreflight`, `jsonError` de `../_lib/cors.js`
- Auth de cron via `x-vercel-cron` ou `Bearer $CRON_SECRET`
- Suporte a `?dry=true` para inspeção sem custo Apify/Gemini
- Erros isolados por fonte/client (não derruba o batch)

### Registrados em `handler-manifest.ts`
4 entradas adicionadas no fim do mapa `handlerLoaders`. Acessíveis via:
- `GET /api/cron-scrape-news`
- `GET /api/cron-scrape-tiktok`
- `GET /api/cron-scrape-instagram`
- `GET /api/cron-generate-daily-brief`

## Parte 3 — `vercel.json` crons

Hobby plan limita 2 daily crons. Decisão: substituir `sync-all-metrics` por `cron-generate-daily-brief`.

```json
"crons": [
  { "path": "/api/cron-generate-daily-brief", "schedule": "0 8 * * *" },
  { "path": "/api/telegram-daily-report",     "schedule": "0 9 * * *" }
]
```

## Parte 4 — Build status

```
$ bun run build
✓ 5000 modules transformed.
✓ built in 6.55s
```

`tsc --noEmit` passa sem erros nos 4 handlers e no projeto inteiro.

## Bloqueios e próximos passos

### Hobby plan (atual)
- Só `cron-generate-daily-brief` (08h UTC) e `telegram-daily-report` (09h UTC) rodam via Vercel Cron.
- Os 3 cron-scrape-* podem ser triggados manualmente via curl com `Bearer $CRON_SECRET`.
- `sync-all-metrics` removido do schedule mas o handler segue disponível em `/api/sync-all-metrics` para chamada manual / via UI.

### Para Pro plan
Adicionar ao `vercel.json`:
```json
{ "path": "/api/cron-scrape-news",      "schedule": "0 */6 * * *" },
{ "path": "/api/cron-scrape-instagram", "schedule": "0 10 * * *" },
{ "path": "/api/cron-scrape-tiktok",    "schedule": "0 11 * * *" },
{ "path": "/api/sync-all-metrics",      "schedule": "0 3 * * *" }
```

### Env vars necessárias
- `CRON_SECRET` — proteção dos endpoints
- `DATABASE_URL` — Neon (já configurado)
- `GEMINI_API_KEY` — para brief generation
- `APIFY_API_KEY` (ou `APIFY_API_KEY_INSTAGRAM`) — para IG/TikTok scrapers
- `RADAR_TIKTOK_CRON_ENABLED=1` — feature flag pra ativar Apify TikTok (custo $)
- `RADAR_IG_CRON_ENABLED=1` — feature flag pra ativar Apify Instagram (custo $)

### Popular `viral_tracked_sources`
Sem fontes cadastradas, todos os crons retornam `skipped: 'No active ... sources'`.

Exemplo de seed (RSS crypto/marketing/ai, alinhado com radar-viral v1):
```sql
INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche, category) VALUES
  ('rss','https://cointelegraph.com/rss','CoinTelegraph','crypto','crypto'),
  ('rss','https://www.coindesk.com/arc/outboundfeeds/rss/','CoinDesk','crypto','crypto'),
  ('rss','https://decrypt.co/feed','Decrypt','crypto','crypto'),
  ('rss','https://livecoins.com.br/feed/','Livecoins','crypto','crypto'),
  ('rss','https://searchengineland.com/feed','Search Engine Land','marketing','seo'),
  ('rss','https://www.marketingbrew.com/feed','Marketing Brew','marketing','growth'),
  ('rss','https://venturebeat.com/category/ai/feed/','VentureBeat AI','ai','news'),
  ('rss','https://huggingface.co/blog/feed.xml','HuggingFace Blog','ai','research');
```

Para IG/TikTok seed precisa decidir: por client (com `client_id`) ou globais. IG só roda quando `client_id IS NOT NULL` (porque `instagram_posts` é per-client).

### Schema constraint TODO
`instagram_posts` não tem UNIQUE em `(client_id, post_id)` no Neon. O handler IG tem fallback select-then-upsert pra esse caso, mas idealmente:
```sql
ALTER TABLE instagram_posts
  ADD CONSTRAINT instagram_posts_client_post_unique
  UNIQUE (client_id, post_id);
```
Não foi aplicado pra evitar surpresa em dados históricos com `post_id` duplicado.

## Arquivos modificados/criados

Criados:
- `migrations/0003_radar_full.sql`
- `api/_handlers/cron-scrape-news.ts`
- `api/_handlers/cron-scrape-tiktok.ts`
- `api/_handlers/cron-scrape-instagram.ts`
- `api/_handlers/cron-generate-daily-brief.ts`
- `RADAR-CRON-DONE.md`

Modificados:
- `api/handler-manifest.ts` (+4 entradas)
- `vercel.json` (cron `sync-all-metrics` → `cron-generate-daily-brief`)
