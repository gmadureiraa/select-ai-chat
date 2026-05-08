# Radar Viral — Multi-Platform Expansion (2026-05-08)

Adiciona **Threads (Meta)**, **X / Twitter** e **LinkedIn** ao Radar Viral, somando às plataformas já cobertas (RSS news, Instagram, TikTok).

## Sumário

| Plataforma | Status anterior | Status novo |
|---|---|---|
| RSS News (15+ fontes) | Live | Live |
| Instagram | Cron gated | Cron gated |
| TikTok | Cron gated | Cron gated |
| Threads | — | Cron gated (novo) |
| X / Twitter | — | Cron gated (novo) |
| LinkedIn | — | Cron gated (novo) |

## Schema (migration 0007)

Aplicada via:

```bash
PSQL=/opt/homebrew/opt/libpq/bin/psql
NEON_URL="postgresql://neondb_owner:npg_HKMtF01ADqwP@ep-sparkling-moon-acbufmuw-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$PSQL "$NEON_URL" -f migrations/0007_radar_more_platforms.sql
```

3 tabelas novas:

- `viral_threads_posts` — posts virais Threads
- `viral_twitter_posts` — tweets virais (separada da `twitter_posts` per-client)
- `viral_linkedin_posts` — posts virais LinkedIn

Atualiza CHECK constraint de `viral_tracked_sources.source_type` pra incluir `threads` e `linkedin` (twitter já estava na lista).

Todas com RLS read-all + write via service-role only.

## Cron handlers (3 novos)

Cada um segue o padrão dos handlers existentes (auth via `x-vercel-cron` / `Bearer CRON_SECRET`, dry-run via `?dry=true`, gated por env flag pra evitar custo inadvertido).

### `cron-scrape-threads`

- Path: `/api/cron-scrape-threads`
- Schedule: `30 11 * * *` (diário 11:30 UTC)
- Apify actor (default): **`apify/threads-scraper`** (override via `APIFY_THREADS_ACTOR`)
- Lê: `viral_tracked_sources` onde `source_type='threads'`
- Persiste: `viral_threads_posts` (UPSERT por `url`)
- Custo estimado: **~$0.01-0.02 por handle** × 30 handles max = ~$0.30-0.60/dia

### `cron-scrape-twitter`

- Path: `/api/cron-scrape-twitter`
- Schedule: `15 11 * * *`
- Apify actor (default): **`xtdata/twitter-x-scraper`** (mesmo usado em `fetch-twitter-apify.ts`, override via `APIFY_TWITTER_ACTOR`)
- Lê: `viral_tracked_sources` onde `source_type='twitter'`
- Suporta dois tipos de `source_url`:
  - **Profile**: `https://x.com/handle` ou `@handle` ou `handle`
  - **Search query**: `search:palavra-chave` (prefixo) ou URL de busca
- **Detecta threads**: agrupa por `conversation_id` quando há 2+ tweets do mesmo autor → salva primeiro tweet como canônico com siblings em `thread_tweets[]` JSONB
- Persiste: `viral_twitter_posts` (UPSERT por `tweet_id`)
- Custo estimado: **~$0.02 por run** (todas handles em uma chamada)

### `cron-scrape-linkedin`

- Path: `/api/cron-scrape-linkedin`
- Schedule: `45 11 * * *`
- 3 actors auto-selecionados pelo formato da `source_url`:
  - **Profile** (`/in/<slug>`): `apify/linkedin-profile-scraper` (override `APIFY_LINKEDIN_PROFILE_ACTOR`)
  - **Company** (`/company/<slug>`): `apify/linkedin-company-scraper` (override `APIFY_LINKEDIN_COMPANY_ACTOR`)
  - **Search** (`search:query`): `apimaestro/linkedin-post-search-scraper` (override `APIFY_LINKEDIN_SEARCH_ACTOR`)
- Persiste: `viral_linkedin_posts` (UPSERT por `post_id`/urn)
- Custo estimado: **~$0.05-0.10 por profile** (LinkedIn é mais caro)
- ⚠️ **LinkedIn detecta bots agressivamente** — esperar ~70% taxa de sucesso. Errors são logados mas não derrubam o cron (continua próximas fontes).

## Daily Brief (atualizado)

`cron-generate-daily-brief` agora agrega das 6 fontes (era 3):

```ts
collectSignals() → { news, ig, tiktok, threads, twitter, linkedin }
```

- Brief gerado por Gemini 2.5 Flash com `responseSchema` (igual antes)
- `sources_summary` JSONB persistido com counts de cada plataforma
- System instruction atualizada pra reconhecer LinkedIn/X verificado como peso institucional maior
- Threshold de "low_signals_skip" continua em 3 sinais totais (agora sobre 6 plataformas em vez de 3)

## UI (`src/components/kai/ViralRadarTab.tsx`)

### Modo Briefing (existente, atualizado)

- Cabeçalho `sources_summary` agora mostra contadores das 6 plataformas (📰📸🎵🧵🐦💼)
- Resto do layout (narrativas / hot topics / carousel ideas / cross-pollination) inalterado

### Modo Feed ao vivo (novo)

- Toggle no header: `Briefing` / `Feed ao vivo`
- Chips de filtro de plataforma: Todas / Notícias / Instagram / TikTok / Threads / X / LinkedIn
- Lê posts brutos das tabelas `viral_*_posts` + `viral_news_articles` + `instagram_posts` (per-client) das **últimas 48h**
- Cards específicos por plataforma com:
  - Thumbnail (quando existe) ou ícone da plataforma
  - Author handle/name + verified badge (X)
  - Texto truncado em 2 linhas
  - 3 métricas relevantes por plataforma:
    - News: data
    - IG: ❤ curtidas, 💬 comentários
    - TikTok: 👁 views, ❤ curtidas, 💬 comentários
    - Threads: ❤ curtidas, 🔁 reposts, 💬 replies
    - X: ❤ curtidas, 🔁 retweets, 👁 views (+ badge "thread" quando aplicável)
    - LinkedIn: 👍 reactions, 💬 comments, 🔁 shares (+ badge tipo: text/image/video/article)
  - Ações inline: virar Carrossel / virar Reel / Salvar ideia / Abrir
- Ordenação: por engajamento principal (decrescente)

## Env vars necessárias

```bash
# Já existentes (inalterados)
APIFY_API_KEY=apify_api_xxx
APIFY_API_KEY_INSTAGRAM=apify_api_xxx  # opcional, fallback APIFY_API_KEY
CRON_SECRET=xxx
DATABASE_URL=postgresql://...
GEMINI_API_KEY=AIza...

# Novos — feature flags pra ligar Apify (default OFF, evita custo)
RADAR_THREADS_CRON_ENABLED=1
RADAR_TWITTER_CRON_ENABLED=1
RADAR_LINKEDIN_CRON_ENABLED=1

# Tokens dedicados opcionais (override do APIFY_API_KEY)
APIFY_API_KEY_THREADS=apify_api_xxx       # opcional
APIFY_API_KEY_TWITTER=apify_api_xxx       # opcional, também aceita APIFY_API_TOKEN
APIFY_API_KEY_LINKEDIN=apify_api_xxx      # opcional

# Override de actors (raramente necessário)
APIFY_THREADS_ACTOR=apify~threads-scraper
APIFY_TWITTER_ACTOR=xtdata~twitter-x-scraper
APIFY_LINKEDIN_PROFILE_ACTOR=apify~linkedin-profile-scraper
APIFY_LINKEDIN_COMPANY_ACTOR=apify~linkedin-company-scraper
APIFY_LINKEDIN_SEARCH_ACTOR=apimaestro~linkedin-post-search-scraper
```

## Vercel cron schedule

`vercel.json` agora declara 8 crons (era 2):

```
30 6 * * *  → cron-scrape-news
0  10 * * * → cron-scrape-instagram
0  11 * * * → cron-scrape-tiktok
15 11 * * * → cron-scrape-twitter
30 11 * * * → cron-scrape-threads
45 11 * * * → cron-scrape-linkedin
0  8  * * * → cron-generate-daily-brief
0  9  * * * → telegram-daily-report
```

⚠️ Vercel free plan permite só 2 crons. **Esse setup precisa de Vercel Pro** (igual TikTok/IG já precisavam).

## Como adicionar fontes novas

```sql
-- Threads (perfil único)
INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche)
VALUES ('threads', 'https://www.threads.com/@hubermanlab', 'Andrew Huberman', 'health');

-- Twitter (perfil)
INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche)
VALUES ('twitter', '@coinbureau', 'Coin Bureau', 'crypto');

-- Twitter (search query)
INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche)
VALUES ('twitter', 'search:bitcoin ETF lang:pt', 'BTC ETF brasileiro', 'crypto');

-- LinkedIn (perfil pessoal)
INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche)
VALUES ('linkedin', 'https://www.linkedin.com/in/jameswang/', 'James Wang (Bernstein)', 'crypto');

-- LinkedIn (empresa)
INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche)
VALUES ('linkedin', 'https://www.linkedin.com/company/coinbase/', 'Coinbase', 'crypto');

-- LinkedIn (search query)
INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche)
VALUES ('linkedin', 'search:agência marketing IA', 'Marketing+IA PT', 'marketing');
```

## Test plan

```bash
# 1. Confirmar tabelas no Neon
psql "$DATABASE_URL" -c "\dt viral_*"

# 2. Dry-run dos novos handlers (não chama Apify)
curl -H "Authorization: Bearer $CRON_SECRET" "https://kai.app/api/cron-scrape-threads?dry=true"
curl -H "Authorization: Bearer $CRON_SECRET" "https://kai.app/api/cron-scrape-twitter?dry=true"
curl -H "Authorization: Bearer $CRON_SECRET" "https://kai.app/api/cron-scrape-linkedin?dry=true"

# 3. Inserir uma fonte teste e rodar o cron real (requer flag ON)
psql "$DATABASE_URL" -c "INSERT INTO viral_tracked_sources (source_type, source_url, source_name, niche) VALUES ('threads', '@zuck', 'Mark Zuckerberg', 'tech');"
curl -H "Authorization: Bearer $CRON_SECRET" "https://kai.app/api/cron-scrape-threads"

# 4. Verificar UI Radar — toggle "Feed ao vivo" → filtrar por Threads
```

## Bloqueios técnicos conhecidos

1. **LinkedIn**: scrapers detectam bot → ~30% taxa de erro esperada. Mitigação: fail-safe (errors não derrubam o cron).
2. **Threads**: actors no Apify Store mudam de nome com frequência (sem actor "oficial" da Apify). Default `apify/threads-scraper` pode precisar ser trocado por `curious_coder/threads-scraper` ou similar; expor via env `APIFY_THREADS_ACTOR` resolve.
3. **Twitter free actor scraping**: `xtdata/twitter-x-scraper` tem rate limit. O cron grupos handles+queries num único run pra mitigar.
4. **LinkedIn cost**: ~$0.05-0.10 por profile vs $0.005 IG → manter `RADAR_LINKEDIN_CRON_ENABLED=0` até confirmar valor.

## Files touched

| File | Change |
|---|---|
| `migrations/0007_radar_more_platforms.sql` | **NEW** — 3 tables + check constraint |
| `api/_handlers/cron-scrape-threads.ts` | **NEW** — 244 LOC |
| `api/_handlers/cron-scrape-twitter.ts` | **NEW** — 343 LOC |
| `api/_handlers/cron-scrape-linkedin.ts` | **NEW** — 342 LOC |
| `api/_handlers/cron-generate-daily-brief.ts` | Updated — collect/prompt/counts agora 6 plataformas |
| `api/handler-manifest.ts` | Regenerated — 104 handlers |
| `vercel.json` | 8 crons declarados (era 2) |
| `src/components/kai/ViralRadarTab.tsx` | Toggle Briefing/Feed + filtros plataforma + cards específicos |

## Build

```bash
bun run build  # ✓ passa em 1m
bunx tsc --noEmit  # ✓ clean
```
