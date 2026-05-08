# Fase E — Radar per-client (concluída)

> Branch: `combo-viral-integration` (não commitar)
> Data: 2026-05-08

## Objetivo

Permitir que cada cliente Kaleidos tenha **suas próprias fontes** monitoradas
pelo Radar Viral, mantendo as fontes globais como base. Os crons de scrape
agora aceitam `?client_id=<uuid>` e o `cron-radar-master` itera sobre clientes
Pro+ disparando rodadas individuais. O brief diário continua rodando pra TODOS
os planos (mas os Pro+ recebem brief enriquecido com sinais das fontes
próprias do cliente).

## Migration aplicada (Neon)

### `migrations/0014_radar_per_client_indexes.sql`

4 indexes pra performance da rota per-client:

| Index | Tabela | Filtro |
|-------|--------|--------|
| `idx_viral_tracked_sources_client_active` | `viral_tracked_sources` | `(client_id, is_active) WHERE is_active=true` |
| `idx_viral_tracked_sources_global_active` | `viral_tracked_sources` | `(is_active, source_type) WHERE client_id IS NULL AND is_active=true` |
| `idx_viral_news_articles_client_lookup` | `viral_news_articles` | `(source_id, published_at DESC)` |
| `idx_viral_radar_briefs_client_recent` | `viral_radar_briefs` | `(client_id, created_at DESC)` |

Todos com `IF NOT EXISTS`, idempotentes. Verificados via `pg_indexes` (4 rows).

## Crons modificados

### `cron-radar-master.ts`

Novo fluxo em duas fases:

1. **GLOBAL** — dispara os 6 scrapers sem `client_id` (fontes onde
   `client_id IS NULL`). Mantém o comportamento legacy.
2. **PER-CLIENT** — query em `clients ⨝ workspace_subscriptions ⨝ subscription_plans`
   filtrando `sp.type IN ('pro','enterprise')` AND `ws.status='active'`.
   Pra cada cliente, dispara os 6 scrapers com `?client_id=<uuid>`.

Limite de 100 clientes pra não estourar o budget de fan-out. Resposta inclui
`pro_clients`, `triggered_count` e o array `triggered` com `{handler, scope, client_id}`.

### `cron-scrape-{news,instagram,tiktok,twitter,threads,linkedin}.ts`

Cada handler agora aceita query param `?client_id=<uuid>`:

- **Sem param** → SELECT só de fontes globais (`client_id IS NULL`).
  Excepção: `instagram` exige `client_id IS NOT NULL` na fonte (porque
  `instagram_posts` é per-client) — sem param itera sobre todas as fontes IG
  de todos os clientes (legacy behavior).
- **Com param** → SELECT só das fontes daquele client (`client_id = $1`).

Resposta inclui `scope: 'global' | 'client'` e `client_id`.

### `cron-generate-daily-brief.ts`

Mudanças:

1. **`pickClientsWithSources()`** virou abrangente:
   - Combina clientes com fontes próprias + clientes sem fontes (que ainda
     vão receber brief baseado em sinais globais).
   - Limite total ~150 (100 com fontes + 50 sem).
   - Fallback pra TODOS os clientes se a query inicial vier vazia (early-launch).
2. **Push notification fan-out** — após gerar brief com sucesso, dispara
   `POST /api/send-push-notification` em fire-and-forget pro `workspace_id`
   do cliente. Payload usa o título da primeira `narrative` + count de ideias
   como body, tag `radar-brief-<client_id>`, deep link `/clients/<id>/radar`.
   Erros são silenciados (não afetam a geração).

## Handler novo: `client-add-source`

`api/_handlers/client-add-source.ts`

- Auth: `authedPost` (Bearer JWT obrigatório).
- Body validado por `zod`:
  ```ts
  {
    client_id: string (uuid),
    source_type: 'rss'|'instagram'|'tiktok'|'youtube'|
                 'twitter'|'threads'|'linkedin'|'newsletter',
    source_url: string (1-2048),
    source_name?: string,
    category?: string,
    niche?: string,
  }
  ```
- Verifica acesso via `workspace_members ⨝ clients` ou `super_admins`.
- **Idempotência**: se já existe fonte com `(client_id, source_type, lower(source_url))`
  retorna a existente; reativa se estava `is_active=false`. Resposta inclui
  `deduped: true` nesse caso.
- Insere com `workspace_id` resolvido do client e `is_active=true`.
- Adicionado em `api/handler-manifest.ts` (regenerado: 118 handlers).

## UI nova: `ClientSourcesManager`

`src/components/kai/viral-radar-original/components/ClientSourcesManager.tsx`

- Tab "Fontes" no MainApp do Radar (`Radio` icon).
- Lista fontes via `supabase.from('viral_tracked_sources').eq('client_id', clientId)`.
- 8 source types suportados (`rss`, `instagram`, `tiktok`, `youtube`, `twitter`,
  `threads`, `linkedin`, `newsletter`) — alinhado ao CHECK constraint da
  migration 0007.
- Empty state quando `clientId === null`: mensagem "Selecione um cliente".
- 4 stat tiles: Total / Ativas / RSS / Sociais.
- CRUD:
  - **Add** → dialog com form (tipo, URL, nome, categoria, nicho) →
    `apiInvoke('client-add-source')` (backend valida acesso e dedupe).
    Placeholder do input de URL muda conforme tipo selecionado.
  - **Toggle is_active** inline via `Switch` (UPDATE direto).
  - **Delete** com confirm dialog (DELETE direto).
- `last_scraped_at` formatado em PT-BR via `formatDistanceToNow(.., { locale: ptBR })`.
- Estilo brutalist do Radar (`--color-rdv-*`, drop-shadow `3px 3px 0`,
  serif italic display).

### Integração no MainApp

`src/components/kai/viral-radar-original/MainApp.tsx`

- Import + tab nova `sources` adicionada ao `NAV` array.
- `MainApp` agora propaga `client?.name` pro `RadarShell`.
- `RadarShell` resolve `clientName` via `clientCtx?.client?.name ?? props.clientName`
  e passa pro `ClientSourcesManager`.
- A tab é visível pra todos os usuários (não é admin-only). Free/Starter
  podem cadastrar fontes mas só Pro+ tem scrape ativado pelo master cron.

## Build status

- `bun run build` (Vite) → ✓ passa em 13.30s
- `dist/assets/MainApp-*.js` agora carrega `ClientSourcesManager` (44.45 kB → MainApp do Radar)
- 0 erros de typecheck nos arquivos novos/tocados desta fase
- `api/handler-manifest.ts` regenerado: 118 handlers

## Critério de "pronto" (todos os itens)

- [x] Migration 0014 aplicada (4 indexes confirmados via `pg_indexes`)
- [x] 6 cron-scrape-* aceitam `?client_id=<uuid>`
- [x] `cron-radar-master` loop por cliente Pro+
- [x] `cron-generate-daily-brief` loop por cliente (TODOS planos) + push notification
- [x] Handler `client-add-source` funcional (zod + workspace access + dedupe)
- [x] `ClientSourcesManager` UI no Radar (tab "Fontes" no MainApp)
- [x] `bun run build` passa
- [x] Documento `VIRAL-INTEGRATION-E.md` (este)

## Conflitos potenciais com outros agentes (verificado)

- **VIRAL-G** (`src/components/kai/viral/ClientContextHeader.tsx`,
  `ClientReferencesPanel.tsx`, drawer expansion) — paths disjuntos. Esta fase
  só lê `useClientWorkspaceContext` (já existente).
- **VIRAL-H** (`src/components/kai/home/`, `src/components/billing/`) — paths
  disjuntos. Esta fase não toca em home nem billing.
- **VIRAL-D** (`embed-client-content.ts`, `client-context.ts`) — sem
  sobreposição. Esta fase só usa `getClientContextServer` que já era exportado.
- **VIRAL-F** (`workspace_tokens`, `debit_tokens`) — sem sobreposição. Esta
  fase só lê `subscription_plans.type` pra gating, não consome tokens.

## Como testar manualmente

### 1. Trigger global scrape (sem client)

```bash
curl -X POST "https://kai-app-combo.vercel.app/api/cron-scrape-news?dry=true" \
  -H "Authorization: Bearer $CRON_SECRET"
# → { ok, scope: 'global', client_id: null, sources: 15, ... }
```

### 2. Trigger per-client scrape

```bash
curl -X POST "https://kai-app-combo.vercel.app/api/cron-scrape-news?client_id=<uuid>&dry=true" \
  -H "Authorization: Bearer $CRON_SECRET"
# → { ok, scope: 'client', client_id: '<uuid>', sources: N, ... }
```

### 3. Master cron com fan-out per-client

```bash
curl -X POST "https://kai-app-combo.vercel.app/api/cron-radar-master" \
  -H "Authorization: Bearer $CRON_SECRET"
# → { ok, pro_clients: N, triggered_count: 6 + N*6, triggered: [...] }
```

### 4. Adicionar fonte via API

```bash
TOKEN="<jwt do user logado>"
curl -X POST "https://kai-app-combo.vercel.app/api/client-add-source" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "<uuid>",
    "source_type": "rss",
    "source_url": "https://example.com/feed.xml",
    "source_name": "Example Blog",
    "category": "crypto",
    "niche": "defi"
  }'
# → { ok: true, source: {...} }  ou  { ok: true, source: {...}, deduped: true }
```

### 5. UI

No KAI:
1. Selecionar um cliente
2. Abrir Radar Viral
3. Sidebar → "Fontes" (entre Newsletters e Admin)
4. Adicionar fonte → ela aparece na lista; toggle e delete funcionam

## Próximos passos sugeridos (fora do escopo Fase E)

- **Quotas per-plan** — limitar quantas fontes per-client cada plano permite
  (Free=0, Starter=3, Pro=20, Enterprise=ilimitado). Hoje qualquer plano pode
  adicionar mas só Pro+ é scrapeado.
- **Onboarding wizard** — sugerir fontes baseadas no `niche` do cliente quando
  ele entra no tab "Fontes" pela primeira vez.
- **Bulk import** — botão "Importar das curated lists" quando o cliente é
  novo (puxa as `sources-curated.ts` por nicho).
- **Histórico per-source** — mini-chart de itens scrapeados/dia pra cada fonte.
