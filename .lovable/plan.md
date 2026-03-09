

# YouTube Metrics: Likes & Comments como Colunas + Fix da API

## Problema Atual

A infraestrutura já existe (`fetch-youtube-metrics`, `YOUTUBE_API_KEY` configurada, dashboard, tabela `youtube_videos`), mas há 3 problemas:

1. **Likes e comments ficam no `metadata` jsonb** em vez de colunas próprias - o dashboard lê `v.likes` que retorna `undefined`
2. **A edge function pede `part=statistics,snippet` mas não `contentDetails`** para channels - então `relatedPlaylists` é sempre null e o fallback `UU${channelId.substring(2)}` pode falhar
3. **Não há botão de "Fetch" no dashboard** para disparar a coleta via API - só CSV upload e RSS

## Plano

### 1. Migration: Adicionar colunas `likes` e `comments` na tabela `youtube_videos`
```sql
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS comments integer DEFAULT 0;
```

### 2. Fix edge function `fetch-youtube-metrics/index.ts`
- Adicionar `contentDetails` ao `part` da request de channels para pegar `relatedPlaylists`
- Salvar likes e comments como colunas top-level em vez de dentro de `metadata`
- Manter metadata para dados extras (description)

### 3. Adicionar botão "Buscar via API" no `YouTubeDashboard.tsx`
- Input para Channel ID (ou pré-popular do client settings)
- Botão que chama `useFetchYouTubeMetrics` mutation
- Feedback de sucesso/erro

### 4. Atualizar `YouTubeVideosTable.tsx`
- Adicionar colunas de Likes e Comments na tabela
- Ordenação por essas métricas

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar colunas `likes`, `comments` |
| `supabase/functions/fetch-youtube-metrics/index.ts` | Fix `contentDetails`, salvar likes/comments como colunas |
| `src/components/performance/YouTubeDashboard.tsx` | Botão "Buscar via API" com input de channel ID |
| `src/components/performance/YouTubeVideosTable.tsx` | Colunas de likes/comments na tabela |

