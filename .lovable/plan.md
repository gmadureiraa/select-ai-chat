
# Plano: Late API de Métricas + Atualização Diária + Sync CSV em Performance

## ✅ Status: IMPLEMENTADO

## Resumo Executivo

Implementar a integração com a API de Analytics do Late para buscar métricas de todas as redes conectadas, atualizar automaticamente todos os dias, e garantir que os CSVs de Twitter, LinkedIn e Instagram façam sync (upsert) corretamente.

## Status Atual

### O que já funciona

| Recurso | Status |
|---------|--------|
| Instagram CSV → `instagram_posts` | ✅ Upsert por `(client_id, post_id)` |
| Twitter CSV → `twitter_posts` | ✅ Upsert por `(client_id, tweet_id)` |
| LinkedIn Excel → `linkedin_posts` | ✅ Upsert por `(client_id, post_id)` |
| `platform_metrics` | ✅ Upsert por `(client_id, platform, metric_date)` |
| Late OAuth | ✅ Conecta contas e salva em `client_social_credentials` |
| Late Post | ✅ Publica via API |
| **Edge Function `fetch-late-metrics`** | ✅ Busca métricas do Late e grava nas tabelas |
| **Cron job diário** | ✅ Documentado (executar SQL no Supabase) |

### Último Teste (07/02/2026)

```json
{
  "success": true,
  "clientsProcessed": 2,
  "totalPostsUpdated": 54,
  "results": [
    { "clientName": "Defiverso", "postsUpdated": { "instagram": 54 } },
    { "clientName": "Gabriel Madureira", "postsUpdated": {} }
  ]
}
```

---

## Parte 1: Nova Edge Function `fetch-late-metrics`

### Arquivos a Criar

```
supabase/functions/fetch-late-metrics/
└── index.ts
```

### Lógica Principal

```text
┌─────────────────────────────────────────────────────────────────┐
│                     fetch-late-metrics                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Buscar clientes com Late conectado                           │
│    SELECT * FROM client_social_credentials                      │
│    WHERE metadata->>'late_profile_id' IS NOT NULL                │
│                                                                 │
│ 2. Para cada profileId único:                                   │
│    a) GET /v1/accounts/follower-stats                           │
│       → Upsert em platform_metrics (subscribers por dia)        │
│                                                                 │
│    b) GET /v1/analytics?profileId=...                           │
│       → Para cada post retornado:                               │
│         - Identificar plataforma                                │
│         - Extrair post_id estável (external_id ou URL)          │
│         - Upsert na tabela correspondente                       │
│           (instagram_posts, twitter_posts, linkedin_posts)      │
│                                                                 │
│ 3. Tratamento de erros                                          │
│    - 402: Analytics add-on necessário → log e continua          │
│    - Timeout/Network: retry leve, depois continua               │
│                                                                 │
│ 4. Retornar JSON com resumo                                     │
│    { clientsProcessed, postsUpdated, errors }                   │
└─────────────────────────────────────────────────────────────────┘
```

### Endpoints do Late API a Usar

| Endpoint | Método | Parâmetros | Retorno |
|----------|--------|------------|---------|
| `/v1/analytics` | GET | `profileId`, `platform?`, `fromDate?`, `toDate?`, `limit`, `page` | Posts com métricas (impressions, reach, likes, comments, shares, clicks, views, engagementRate, platformPostUrl, publishedAt) |
| `/v1/accounts/follower-stats` | GET | `profileId`, `fromDate?`, `toDate?`, `granularity` | Histórico de seguidores por dia |

### Mapeamento Late → Tabelas

| Campo Late | Instagram | Twitter | LinkedIn | platform_metrics |
|------------|-----------|---------|----------|-----------------|
| `id` / `externalId` | `post_id` | `tweet_id` | `post_id` | - |
| `content` | `caption` | `content` | `content` | - |
| `publishedAt` | `posted_at` | `posted_at` | `posted_at` | `metric_date` |
| `likes` | `likes` | `likes` | `likes` | `likes` |
| `comments` | `comments` | `replies` | `comments` | `comments` |
| `shares` | `shares` | `retweets` | `shares` | `shares` |
| `impressions` | `impressions` | `impressions` | `impressions` | `views` |
| `reach` | `reach` | - | - | - |
| `engagementRate` | `engagement_rate` | `engagement_rate` | `engagement_rate` | `engagement_rate` |
| `platformPostUrl` | `permalink` | (extrair tweet_id) | `post_url` | - |
| `followers` (stats) | - | - | - | `subscribers` |

### Detalhes de Implementação

```typescript
// Estrutura principal da Edge Function
const LATE_API_BASE = "https://getlate.dev/api/v1";

interface LateAnalyticsPost {
  id: string;
  externalId?: string;
  platform: string;
  content?: string;
  publishedAt?: string;
  platformPostUrl?: string;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  views?: number;
  engagementRate?: number;
}

async function fetchLateAnalytics(profileId: string, lateApiKey: string, options?: {
  platform?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const params = new URLSearchParams({ profileId });
  if (options?.platform) params.set('platform', options.platform);
  if (options?.fromDate) params.set('fromDate', options.fromDate);
  if (options?.toDate) params.set('toDate', options.toDate);
  
  const response = await fetch(`${LATE_API_BASE}/analytics?${params}`, {
    headers: { Authorization: `Bearer ${lateApiKey}` }
  });
  
  if (response.status === 402) {
    throw new Error('ANALYTICS_ADDON_REQUIRED');
  }
  
  if (!response.ok) {
    throw new Error(`Late API error: ${response.status}`);
  }
  
  return response.json();
}
```

---

## Parte 2: Cron Job Diário

### Configuração

Adicionar ao `AUTOMATIONS.md` e executar no SQL Editor:

```sql
-- JOB 4: Buscar métricas do Late (diariamente às 7h UTC)
SELECT cron.schedule(
  'fetch-late-metrics-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/fetch-late-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Atualizar config.toml

```toml
[functions.fetch-late-metrics]
verify_jwt = false
```

---

## Parte 3: CSV Sync (Verificação)

### Status das Constraints UNIQUE (Já Existem)

| Tabela | Constraint | Suporte a Upsert |
|--------|------------|-----------------|
| `instagram_posts` | `(client_id, post_id)` | Funciona |
| `twitter_posts` | `(client_id, tweet_id)` | Funciona |
| `linkedin_posts` | `(client_id, post_id)` | Funciona |
| `platform_metrics` | `(client_id, platform, metric_date)` | Funciona |

### Verificação dos Hooks de Import

| Hook | Usa Upsert? | onConflict |
|------|-------------|------------|
| `useImportInstagramPostsCSV` | Sim | `client_id,post_id` |
| `useImportTwitterCSV` | Sim | `client_id,tweet_id` |
| `useImportLinkedInExcel` | Sim | `client_id,post_id` |

**Todos os imports já fazem sync (upsert)** - apenas precisa documentar melhor na UI.

### Melhoria de UX

Adicionar tooltip/texto nos componentes de upload:

```typescript
// Em SmartCSVUpload.tsx ou similar
const helpText = "O CSV será sincronizado com os dados existentes: " +
  "posts já cadastrados serão atualizados com as informações da planilha; " +
  "posts novos serão adicionados.";
```

---

## Parte 4: Botão de Refresh Manual (Opcional)

Adicionar na área de Performance um botão para forçar atualização:

```typescript
// Hook para chamar fetch-late-metrics
const useFetchLateMetrics = () => {
  return useMutation({
    mutationFn: async (clientId?: string) => {
      const { data, error } = await supabase.functions.invoke('fetch-late-metrics', {
        body: { clientId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
      queryClient.invalidateQueries({ queryKey: ['twitter-posts'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    }
  });
};
```

---

## Ordem de Implementação

| # | Tarefa | Prioridade | Estimativa |
|---|--------|------------|------------|
| 1 | Criar Edge Function `fetch-late-metrics` | Alta | 45 min |
| 2 | Atualizar `supabase/config.toml` | Alta | 2 min |
| 3 | Documentar cron job em `AUTOMATIONS.md` | Alta | 10 min |
| 4 | Adicionar tooltip de sync nos uploads CSV | Média | 15 min |
| 5 | (Opcional) Botão "Atualizar métricas" | Baixa | 20 min |

---

## Requisitos e Dependências

### Pré-requisitos

1. **Late API Key** configurada em Supabase Secrets (`LATE_API_KEY`)
2. **Late Analytics Add-on** ativo na conta Late (necessário para endpoints de analytics)
3. **Vault Secrets** configurados: `project_url` e `cron_service_role_key`

### Tratamento de Erros

| Erro | Comportamento |
|------|---------------|
| 402 (Add-on required) | Log warning, continua para próximo cliente |
| 404 (Profile not found) | Log info, continua |
| 429 (Rate limit) | Retry com backoff, max 3 tentativas |
| 5xx | Log error, continua para próximo cliente |

---

## Detalhes Técnicos

### Estrutura da Edge Function

```
fetch-late-metrics/
└── index.ts
```

A função deve:
1. Aceitar `{ clientId?: string }` no body (opcional)
2. Se `clientId` não for passado, processar todos os clientes com Late conectado
3. Usar `SUPABASE_SERVICE_ROLE_KEY` para queries sem RLS
4. Retornar resumo JSON com estatísticas

### Extração de Post ID Estável

```typescript
function extractStablePostId(platform: string, post: LateAnalyticsPost): string | null {
  // Preferir externalId se disponível
  if (post.externalId) return post.externalId;
  
  // Extrair do URL da plataforma
  const url = post.platformPostUrl || '';
  
  switch (platform) {
    case 'twitter':
      const tweetMatch = url.match(/status\/(\d+)/);
      return tweetMatch ? tweetMatch[1] : post.id;
    
    case 'instagram':
      const igMatch = url.match(/\/p\/([^\/]+)/);
      return igMatch ? igMatch[1] : post.id;
    
    case 'linkedin':
      const liMatch = url.match(/activity:(\d+)/);
      return liMatch ? liMatch[1] : post.id;
    
    default:
      return post.id;
  }
}
```

---

## Resultado Final

Após implementação:

1. **Late = fonte oficial de métricas** para redes conectadas via OAuth
2. **Atualização automática diária** às 7h UTC
3. **CSV complementa/sobrescreve** quando o usuário quiser dados mais detalhados
4. **Cards de Performance** mostram dados atualizados combinando Late + CSV
