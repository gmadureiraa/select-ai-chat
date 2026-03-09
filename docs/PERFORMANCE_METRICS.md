# 📊 Performance Hub & Métricas

## Visão Geral

O Performance Hub centraliza a coleta, visualização e análise de métricas de todas as redes sociais do cliente em um único dashboard. Oferece comparação de períodos, análise de top performers e geração automática de relatórios.

---

## 🏗️ Componentes

```
src/components/performance/
├── InstagramDashboard.tsx        # Dashboard Instagram (posts, stories, métricas)
├── LinkedInDashboard.tsx         # Dashboard LinkedIn (posts, engajamento)
├── YouTubeVideosTable.tsx        # Tabela de vídeos YouTube
├── MetaAdsCampaignsTable.tsx     # Tabela de campanhas Meta Ads
├── VirtualizedPostsTable.tsx     # Tabela virtualizada (react-window) para grandes volumes
├── SyncToLibraryDialog.tsx       # Sincronizar posts para Content Library
├── BeehiivDashboard.tsx          # Métricas de newsletters Beehiiv
└── PerformanceReport.tsx         # Geração de relatórios de performance
```

---

## 📦 Tabelas de Dados

### `instagram_posts`
```sql
{
  id, client_id, post_id,
  caption, post_type,           -- image, video, carousel, reel
  posted_at, permalink,
  likes, comments, shares, saves,
  impressions, reach,
  engagement_rate,
  images: jsonb,                -- Array de URLs de mídia
  thumbnail_url,
  is_favorite,
  full_content,                 -- Conteúdo completo para análise
  content_library_id,           -- Ref para biblioteca (quando sincronizado)
  content_synced_at
}
```

### `instagram_stories`
```sql
{
  id, client_id, story_id,
  media_type, posted_at,
  views, reach, likes, replies, shares,
  forward_taps, back_taps, exit_taps, next_story_taps,
  retention_rate, interactions,
  thumbnail_url, metadata
}
```

### `linkedin_posts`
```sql
{
  id, client_id, post_id,
  content, full_content,
  posted_at, post_url,
  likes, comments, shares, clicks,
  impressions, engagements, follows,
  engagement_rate,
  images: jsonb,
  is_favorite,
  content_synced_at
}
```

### `twitter_posts`
```sql
{
  id, client_id, tweet_id,
  content, full_content,
  posted_at, tweet_url,
  likes, retweets, replies, quotes,
  impressions, engagements,
  engagement_rate,
  bookmark_count, detail_expands, hashtag_clicks,
  is_favorite
}
```

### `youtube_videos`
```sql
{
  id, client_id, video_id,
  title, description, thumbnail_url,
  published_at, duration,
  total_views, likes, comments, shares,
  watch_time_minutes, average_view_duration,
  impressions, click_through_rate,
  subscribers_gained, subscribers_lost,
  is_favorite
}
```

### `meta_ads_ads` / `meta_ads_adsets`
```sql
-- Ads
{ id, client_id, ad_name, adset_name, ad_status,
  impressions, reach, amount_spent, results, cost_per_result,
  quality_ranking, engagement_rate_ranking, conversion_rate_ranking }

-- Adsets
{ id, client_id, adset_name, adset_status,
  budget, bid, bid_type, targeting, attribution_setting }
```

---

## 🔄 Coleta de Métricas

### Edge Functions de Coleta

| Função | Plataforma | Trigger |
|--------|-----------|---------|
| `fetch-instagram-metrics` | Instagram | Manual + Cron |
| `fetch-youtube-metrics` | YouTube | Manual + Cron |
| `fetch-late-metrics` | LinkedIn/Twitter (via Late API) | Manual + Cron |
| `fetch-beehiiv-metrics` | Beehiiv Newsletters | Manual + Cron |

### Fluxo de Coleta
```
Cron Job (diário)
  │
  ├── Para cada cliente com credenciais válidas:
  │   ├── fetch-instagram-metrics → Instagram Graph API
  │   ├── fetch-youtube-metrics → YouTube Data API
  │   ├── fetch-late-metrics → Late API (LinkedIn + Twitter)
  │   └── fetch-beehiiv-metrics → Beehiiv API
  │
  └── Resultados salvos nas tabelas de posts
      → Cálculo automático de engagement_rate
      → Detecção de top performers
```

---

## 📈 Dashboard Features

### Métricas de Perfil
- Seguidores ganhos/perdidos no período
- Impressões totais
- Taxa de engajamento média
- Comparação período anterior (deltas ↑↓)

### Análise de Posts
- Tabela virtualizada (react-window) para performance com centenas de posts
- Ordenação por qualquer métrica (likes, impressions, engagement_rate)
- Badges de performance (🔥 Viral, ⭐ Top, 📈 Above Average)
- Filtros por tipo de conteúdo e período

### Top Performers
- Identificação automática dos 3-5 melhores posts do período
- Análise qualitativa (copy, timing, formato) via `generate-performance-insights`
- Recomendações acionáveis

### Sincronização com Biblioteca
- Dialog `SyncToLibraryDialog` para importar posts para `client_content_library`
- Preserva mídia, caption e metadados
- Evita duplicatas via `content_synced_at`

---

## 📋 Relatórios de Performance

### Geração (`usePerformanceReport`)
```
Usuário seleciona período
  → Coleta métricas do período
  → Compara com período anterior
  → Chama generate-performance-insights
  → Gera relatório com:
     - KPIs consolidados
     - Top 3 posts com análise
     - Recomendações
  → Salva automaticamente na Content Library (tipo 'other')
```

### Edge Function `generate-performance-insights`
- Recebe métricas agregadas + top posts
- Analisa padrões de sucesso (timing, formato, temas)
- Gera insights acionáveis em linguagem natural
- Retorna recomendações específicas para o próximo período

---

## 🔗 Hooks

| Hook | Função |
|------|--------|
| `useInstagramPosts` | CRUD posts Instagram + sync |
| `useInstagramStories` | Métricas de stories |
| `useLinkedInPosts` | Posts LinkedIn |
| `useYouTubeVideos` | Vídeos YouTube |
| `usePerformanceReport` | Geração de relatórios |

---

*Última atualização: Março 2026*
