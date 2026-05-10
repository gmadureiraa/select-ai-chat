# Radar Multi-Platform — Threads / X / LinkedIn

**Data:** 2026-05-10
**Escopo:** Adicionar 3 seções dedicadas no Dashboard do Radar Viral para Threads, X (Twitter) e LinkedIn — usando as tabelas `viral_threads_posts`, `viral_twitter_posts`, `viral_linkedin_posts` que já são populadas pelos crons em produção (`cron-scrape-threads`, `cron-scrape-twitter`, `cron-scrape-linkedin`).

---

## 1. Endpoints API criados

Nenhum endpoint dedicado existia para essas 3 plataformas (só `radar-data-instagram`, `radar-data-news`, `radar-data-youtube`). Criei seguindo o mesmo padrão defensivo (introspection antes de query — retorna `[]` se a tabela não existir, evita crash em ambientes sem migração).

### `api/_handlers/radar-data-threads.ts`
- Query: `viral_threads_posts` filtrada por `niche` opcional
- Default: últimos **168h (7 dias)**, limit 20 (máx 60)
- Sort `top` (default): `ORDER BY (likes + reposts + replies) DESC`
- Sort `recent`: `ORDER BY posted_at DESC`

### `api/_handlers/radar-data-twitter.ts`
- Query: `viral_twitter_posts` (inclui `is_thread` + `thread_tweets` JSONB)
- Engajamento ponderado: `likes + retweets*2 + replies + bookmarks` (retweet vale mais — amplifica alcance)
- Retorna `views`, `bookmarks`, `author_verified`, `author_name` granular

### `api/_handlers/radar-data-linkedin.ts`
- Query: `viral_linkedin_posts` (com `author_headline`, `post_type`, `reactions`)
- Engajamento ponderado: `reactions + comments*2 + shares*3` (compartilhamento vale 3x — sinal mais forte de B2B)
- Default 168h pq LinkedIn tem ciclo viral mais lento

### Registrados em `api/handler-manifest.ts`
Adicionadas 3 entradas em ordem alfabética:
- `radar-data-linkedin`
- `radar-data-threads`
- `radar-data-twitter`

---

## 2. Componentes criados

Em `src/components/kai/viral-radar-original/components/`:

### `top-threads-section.tsx`
- Header: ícone `AtSign` + "Top Threads"
- Badge plataforma: `bg: rgba(10,9,8,0.08) / text: ink` (preto, igual TikTok)
- Stats: likes / reposts / replies / views
- Grid `auto-fit minmax(260px, 1fr)` (3 colunas desktop, 1 mobile)
- `<CrossAppActions />` com `showReel={false}` (post de texto não vira reel)
- `metadata.platform: "threads"` propagado

### `top-twitter-section.tsx`
- Header: ícone `Twitter` (lucide) + "Top X / Twitter"
- Badge "X" `bg: sky-500/10 text: sky-600` (azul claro)
- Stats: likes / retweets / replies / bookmarks / views
- Verificado: `CheckCircle2` em `sky-500` (selo azul)
- Detecta `is_thread`: badge `THREAD · Nx` em coral REC + briefing concatena todos os tweets pra carrossel rico
- Avatar com inicial em `sky-500`

### `top-linkedin-section.tsx`
- Header: ícone `Linkedin` + "Top LinkedIn"
- Badge "IN" `bg: blue-700/10 text: blue-700` (azul corporativo)
- Stats: reactions / comments / shares + `post_type` quando ≠ "text"
- Card mais alto (truncate 240 chars) — LI aceita posts longos
- Author com `headline` (B2B context) + `name` em destaque
- Grid `minmax(280px, 1fr)` (cards mais largos)

### Padrões compartilhados
- `PlatformAvatar` local com inicial do handle (cor por plataforma)
- `RichEmpty` explica motivo + CTA "Adicionar perfis" → `/app/settings`
- `formatCount` (k/M) e `relativeTime` (há Xmin/Xh/Xd)
- Tudo PT-BR
- A11y: `aria-label` no Loader + nos botões "Abrir", `aria-hidden` em ícones decorativos

---

## 3. Hooks criados

Não foram criados hooks dedicados — os componentes seguem o mesmo padrão de fetch inline já usado em `top-instagram-section.tsx` e `top-youtube-section.tsx` (não havia hooks `useRadarInstagram`/`useRadarYouTube` pra mimicar). Cada componente faz seu próprio `useEffect + fetch` com cancellation flag.

Se futuramente houver consolidação, a abstração natural é `useRadarPlatformData<T>(endpoint, params)` em `src/components/kai/viral-radar-original/hooks/`.

---

## 4. Wire-up em `Dashboard.tsx`

Imports adicionados:
```ts
import { TopThreadsSection } from "../components/top-threads-section";
import { TopTwitterSection } from "../components/top-twitter-section";
import { TopLinkedinSection } from "../components/top-linkedin-section";
```

Layout atualizado (acima de Cross-Pollination):

```
ROW 1: Resumo do dia | Temas em alta
ROW 2: Top 4 Reels | Top 4 Carrosseis (Instagram)
ROW 3 [NOVO]: Top 6 Threads | Top 6 X / Twitter
ROW 4: Top YouTube (carrossel horizontal full-width)
ROW 5 [NOVO]: Top 9 LinkedIn (full-width grid)
   ↓
Cross-Pollination → Narrativas → Ideias
   ↓
Conteúdo bruto · News (já existia)
   ↓
Loop Closure
```

LinkedIn ficou em row própria (full-width) porque os cards são mais altos (240 chars + headline) e precisam de respiro. Threads + X estão em duas colunas porque ambos são posts curtos similares.

Filtro de plataforma (chip alternar entre tudo / só Threads / etc) — **não implementado** nesta passada conforme briefing ("não obrigatório, deixar pra próxima"). O dashboard com tudo visível já funciona como baseline.

---

## 5. Tipos adicionados em `types.ts`

Em `src/components/kai/viral-radar-original/types.ts`:
- `ThreadsPostRow` (url, author_handle, likes, reposts, replies, views, etc)
- `TwitterPostRow` (tweet_id, is_thread, thread_tweets, retweets, bookmarks, etc)
- `LinkedInPostRow` (post_id, author_headline, post_type, reactions, shares, etc)

Schemas refletem exatamente o INSERT INTO de cada cron handler.

---

## 6. Build

```
$ bun run build
✓ 5059 modules transformed.
✓ built in 6.67s
```

Sem erros TypeScript. Sem warnings novos. Bundle `index-BXesbRpP.js` (366 kB) inclui as 3 novas seções (~4-5kB cada quando code-split for habilitado, hoje vão na chunk principal).

---

## Arquivos tocados

**Criados (5):**
- `api/_handlers/radar-data-threads.ts`
- `api/_handlers/radar-data-twitter.ts`
- `api/_handlers/radar-data-linkedin.ts`
- `src/components/kai/viral-radar-original/components/top-threads-section.tsx`
- `src/components/kai/viral-radar-original/components/top-twitter-section.tsx`
- `src/components/kai/viral-radar-original/components/top-linkedin-section.tsx`

**Modificados (3):**
- `api/handler-manifest.ts` — 3 novas linhas
- `src/components/kai/viral-radar-original/types.ts` — 3 novos types
- `src/components/kai/viral-radar-original/pages/Dashboard.tsx` — 3 imports + 2 novas rows

---

## Próximos passos sugeridos

1. **Filtro chip por plataforma** no header do dashboard (`Tudo · IG · Threads · X · YT · LI · News`) — UX nice-to-have
2. **Hook compartilhado** `useRadarPlatformData` se a duplicação de `useEffect+fetch` virar padrão
3. **Empty state com sugestões curadas** (igual `RichEmptyIG` lê `getCuratedSources(nicheId)`) — exige expandir `lib/sources-curated.ts` com `threadsHandles`, `twitterHandles`, `linkedinHandles` por nicho
4. **Reel para X threads**: tweets longos + thread podem virar Reel (briefing já tá rico) — bastaria habilitar `showReel={true}` no `TwitterCard` quando `is_thread=true`
5. **Verificar `niche` populado**: se o cron não preencher `niche` em todas as fontes, o filtro vai retornar vazio. Endpoint cai em "sem niche → all rows" se não passar query param, mas o Dashboard sempre passa `niche.id`.
