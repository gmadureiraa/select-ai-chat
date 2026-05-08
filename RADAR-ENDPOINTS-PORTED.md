# Radar Endpoints — Ported

Branch: `combo-viral-integration`. Sem commit.

## Resumo
Portados 8 endpoints do Radar Viral (`code/radar-viral/app/api/`) para o
catch-all router de `kai-app-combo` (`api/_handlers/<slug>.ts`). Tabelas
do KAI usam prefixo `viral_*` em alguns casos — adaptei queries pra
casar com o schema real do Neon do KAI.

## Handlers criados

| Slug do router            | Source                                         | Método | Auth          |
|---------------------------|------------------------------------------------|--------|---------------|
| `radar-brief`             | `app/api/brief/route.ts`                       | GET    | opcional      |
| `radar-data-news`         | `app/api/data/news/route.ts`                   | GET    | opcional      |
| `radar-data-instagram`    | `app/api/data/instagram/posts/route.ts`        | GET    | opcional      |
| `radar-data-youtube`      | `app/api/data/videos/route.ts`                 | GET    | opcional      |
| `radar-subscription`      | `app/api/me/subscription/route.ts`             | GET    | opcional      |
| `radar-last-sync`         | `app/api/last-sync/route.ts`                   | GET    | nenhum        |
| `radar-admin-stats`       | `app/api/admin/stats/route.ts`                 | GET    | obrigatório + email admin |
| `radar-img-proxy`         | `app/api/img/route.ts`                         | GET    | nenhum        |

## Mapping de schema (KAI ↔ Radar v1)

KAI usa nomes de tabela diferentes. Ajustes nas queries:

| Radar v1                   | KAI                                       | Notas |
|----------------------------|-------------------------------------------|-------|
| `daily_briefs`             | `viral_radar_briefs`                      | Filtro `status='completed'`, ordena por `brief_date,created_at` |
| `news_articles`            | `viral_news_articles`                     | Colunas: `url→link`, `summary→description`, `thumbnail_url→thumbnail`, `published_at→pub_date`. Sem `source_color` (retorna `null`). |
| `instagram_posts` (radar)  | `instagram_posts` (KAI = client-scoped)   | Schema diferente. Handler faz introspection da coluna `niche`; se faltar retorna `[]`. |
| `videos`                   | (não existe em KAI ainda)                 | Handler faz introspection; se ausente retorna `[]`. |
| `user_subscriptions_radar` | `workspace_subscriptions` + `workspaces`  | Subscription buscada por `workspaces.owner_id = user.id` JOIN `subscription_plans`. |
| `saved_items`/`cron_run_log`/`ai_usage_log`/`instagram_scrape_runs`/`newsletter_articles`/`user_profiles` | (não existem em KAI) | Admin stats usa helpers `safeCount`/`safeFloat`/`safeRows` com try/catch — campos faltantes ficam zerados. |

## URLs alteradas no frontend

Em `src/components/kai/viral-radar-original/`:

| Antes                          | Depois                          | Arquivos |
|--------------------------------|---------------------------------|----------|
| `/api/brief?niche=...`         | `/api/radar-brief?niche=...`    | `pages/Dashboard.tsx` |
| `/api/me/subscription`         | `/api/radar-subscription`       | `pages/Dashboard.tsx` |
| `/api/last-sync`               | `/api/radar-last-sync`          | `pages/Dashboard.tsx` |
| `/api/data/news?...`           | `/api/radar-data-news?...`      | `components/top-news-section.tsx` |
| `/api/data/instagram/posts?...`| `/api/radar-data-instagram?...` | `components/top-instagram-section.tsx` |
| `/api/data/videos?...`         | `/api/radar-data-youtube?...`   | `components/top-youtube-section.tsx` |
| `/api/admin/stats`             | `/api/radar-admin-stats`        | `pages/Admin.tsx` |
| `/api/img?url=...`             | `/api/radar-img-proxy?url=...`  | `lib/img-proxy.ts` |

`/api/data/saved` e `/api/data/newsletters` **não foram tocados** — fora do
escopo (outro agente).

## Manifest

`api/handler-manifest.ts` regenerado: 113 handlers (era 105 antes do port +
removidos `viral-hunter` etc; agora com 8 novos `radar-*`).

## Auth

- `radar-brief`, `radar-data-*`, `radar-subscription` usam `tryAuth(req)` —
  funcionam anônimo (free user vê dados globais; subscription cai em free).
- `radar-last-sync` e `radar-img-proxy` não exigem auth (público).
- `radar-admin-stats` usa `verifyAuth(req)` + check de email (`gf.madureira@hotmail.com`,
  `gf.madureiraa@gmail.com`).

## Defensive patterns

Como o KAI ainda não tem todas as tabelas do Radar v1, os handlers usam
introspection (`information_schema.columns/.tables`) ou helpers com `try/catch`
que caem em valores neutros (`[]`, `0`, `null`) quando a tabela ou coluna não
existe. Frontend não vai crashar — só vai mostrar UI vazia onde os dados
faltam.

## Build

`bun run build` ✅ (45.52s, sem erros nem warnings).

## Pendente (fora do escopo deste agente)

- Endpoints `/api/data/saved` e `/api/data/newsletters` (outro agente).
- Cron de YouTube/`videos` table (não existe em KAI).
- Tabelas `saved_items`, `cron_run_log`, `ai_usage_log`, `instagram_scrape_runs`,
  `newsletter_articles`, `user_profiles` precisam migration se quisermos admin
  stats com dados reais (hoje retornam 0).
