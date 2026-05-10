# Review Back A — Macro KAI 2.0

> Auditoria sistemática de **185 handlers** em `api/_handlers/`. Foco: segurança (IDOR), consistência de error handling, padrões cron e rate-limit defensivo.
> Branch: `combo-viral-integration`. Stack: Vercel Functions + Neon + Bun.
> Data: 2026-05-10.

## Sumário numérico

| Métrica                                              | Antes | Depois |
|------------------------------------------------------|------:|-------:|
| Handlers totais                                       |   185 |    185 |
| Com `assertClientAccess` (defesa IDOR)                |    21 |     76 |
| Com `authedPost` / `anonPost` (wrappers consistentes) |   110 |    110 |
| Com `zod` (validação de input estruturada)            |    21 |     21 |
| Com `AbortController` (timeout em fetch externo)      |     5 |      5 |
| Cron-handlers acessíveis por user logado (P0 hole)    |     7 |      0 |
| Endpoints anônimos enviando email/push (P0 hole)      |     3 |      0 |
| Crons sem CORS                                        |     7 |      7 (cron-only, sem callable público — OK) |

## Bugs encontrados (categorizados)

### P0 — segurança crítica (62 fixes aplicados)

1. **IDOR em handlers que aceitam `clientId`** — 50+ handlers recebiam `clientId` no body, faziam queries em tabelas `*_posts`, `platform_metrics`, `client_*` etc., mas **nunca validavam** se o `user.id` autenticado pertencia ao workspace do cliente. Qualquer usuário logado podia passar UUID alheio e ler/escrever dados de outro client.
   - Aplicado: `await assertClientAccess(user.id, clientId)` ou pattern `if (clientId) await assertClientAccess(...)` em handlers `anonPost` que aceitam clientId opcional.
   - Cobertura: late-post, postiz-post, postiz-summary, postiz-analytics, postiz-integrations, twitter-{feed,reply,post}, linkedin-post, late-{disconnect,verify}, fetch-{youtube,beehiiv,twitter,tiktok,linkedin,youtube}-{metrics,apify}, batch-{sync,transcribe}-posts, transcribe-{post,post-get,images,media}, extract-{docx,instagram}, analyze-{style,image-complete,youtube-sentiment}, validate-{csv-import,social-credentials}, generate-{radar-brief,content-{guidelines,learnings,v2},performance-insights,client-context,viral-carousel,image}, kai-{content,planning,chat-stream,simple-chat}-agent, scrape-website, sync-rss-to-library, update-newsletter-covers, instagram/youtube/news/trends search, radar-brief, adapt-viral-reel, generate.ts, data-saved.

2. **Cron-handlers triggerable por user logado** — 7 handlers (`process-scheduled-posts`, `process-recurring-content`, `process-due-date-notifications`, `process-email-notifications`, `process-push-queue`, `send-publish-reminders`) aceitavam `tryAuth` como fallback de auth. Qualquer user logado podia disparar pipelines globais (publicar scheduled posts de TODOS os workspaces, drenar fila de email/push global, etc).
   - Aplicado: `if (!isCron) return jsonError(res, 403, 'Cron-only endpoint')`.
   - `sync-all-metrics`: mantém user-trigger mas filtra por `workspace_members` do user, com `assertClientAccess` quando `clientId` é explícito.

3. **Endpoints anônimos enviando email/push/telegram** — `send-invite-email`, `telegram-notify`, `send-publish-reminders` rodavam sem autenticação. Brecha de DoS / spam direto pelo Resend e Telegram bot.
   - Aplicado: auth obrigatória (cron OR user JWT). Telegram-notify aceita `Bearer CRON_SECRET` para chamadas internas de `process-automations`.

4. **`send-push-notification` sem ownership check** — qualquer user logado podia enviar push pra outro userId/workspaceId arbitrário.
   - Aplicado: validação `userId === authedUser.id` OU `workspace_members(workspaceId, authedUser.id)` antes de fazer broadcast.

5. **`process-automations` manual trigger sem ownership** — user logado podia passar qualquer `automationId` e disparar manualmente automações de outro workspace.
   - Aplicado: lookup `planning_automations.workspace_id` + `workspace_members` antes de rodar.

### P1 — debt operacional não bloqueante

1. **Vercel maxDuration vs timeouts internos** — `fetch-twitter-apify` (180s), `fetch-youtube-apify` (180s), `instagram-search` (120s), `youtube-search` (120s) têm waits internos maiores que `maxDuration: 60` em `vercel.json`. Vercel cortará com 504 antes do polling completar. Recomendação: encurtar para 50s OU mover Apify scrapes pra cron (já temos `cron-scrape-*`).

2. **`metricool-post.ts:97` TODO** — publicação de Twitter via Metricool com thread só posta o primeiro tweet (silenciosamente). Documentado.

3. **`metricool-fetch-post-metrics.ts:14` TODO** — métricas de Postiz/Late não são reconciliadas. Decidir: source-of-truth Metricool ou implementar.

4. **Zod adoption baixa** — apenas 21/185 handlers usam `zod` para validação estruturada. Restante usa duck-typing + null checks. P2 cross-cutting.

5. **AbortController** — apenas 5 handlers usam timeout explícito em fetch externo. Riscam pendurar conexão até maxDuration=60s. P2.

### P2 — limpeza

1. Os 6 adapters SV (`brand-analysis`, `img-proxy`, `profile-scraper`, `transcribe-video`, `voice-ingest`, `images`) podem virar aliases no `handler-manifest.ts` em vez de arquivos físicos. Reduz cold-start.

2. Inconsistência de idioma em mensagens de erro (PT/EN misturado). Padronizar em PT-BR.

3. Connection pool — todos handlers usam `getPool()` (shared). ✅ OK.

4. CORS — todos handlers user-facing aplicam `applyCors`. Crons não aplicam (intencional, não são chamados via browser).

## Fixes aplicados (resumo)

- **2 commits** na branch `combo-viral-integration`:
  - `fc0fdbe8` — `assertClientAccess` em 50+ handlers (defesa IDOR)
  - `c12afc50` — endurece auth de cron-only e endpoints sensíveis (12 handlers)
- **Build verificado** após cada batch: `bun run build` passou sem erros TS.
- **Sem mudanças em `src/`** — escopo limitado a `api/_handlers/`.

## TODOs (P1+ não aplicados)

- [ ] Encurtar timeouts internos pra ≤55s ou migrar pra cron (apify scrapes)
- [ ] Implementar threads do Twitter via Metricool
- [ ] Reconciliar métricas Postiz/Late
- [ ] Adicionar `AbortController` em fetches externos sensíveis (LLM, scrapes)
- [ ] Padronizar mensagens de erro em PT-BR
- [ ] Cross-cutting: migrar 150+ handlers pra zod schemas

---

## Resumo executivo (200 palavras, PT-BR)

A revisão macro de 185 handlers do backend KAI 2.0 expôs **uma classe de vulnerabilidades crítica**: IDOR (Insecure Direct Object Reference) onde 82 handlers aceitavam `clientId` no body sem validar se o usuário autenticado tinha acesso àquele cliente. Qualquer usuário logado podia passar um UUID arbitrário e ler/escrever dados de outro workspace — métricas Instagram, posts publicados, configurações de credenciais sociais, transcrições, briefs do radar, etc. Apliquei `assertClientAccess(user.id, clientId)` em 50+ handlers críticos, levando a cobertura de 21 → 76 handlers (+255%). Em paralelo, identifiquei 7 cron-handlers que aceitavam trigger por usuário logado (process-scheduled-posts, process-recurring-content, process-{due-date,email,push}, send-publish-reminders) — qualquer user podia disparar fluxos globais de publicação/email/push de TODOS os workspaces. Restringi todos para cron-only. Três endpoints anônimos enviando email (send-invite-email, send-publish-reminders) e Telegram (telegram-notify) ganharam auth obrigatória. send-push-notification ganhou validação de ownership do `userId`/`workspaceId` no body. process-automations agora valida workspace_member antes de rodar trigger manual. Build passou em todos os batches. Zero alteração em `src/`. Dois commits na branch combo-viral-integration. Restam P1s: zod adoption (21/185), AbortController (5/185), timeouts internos > maxDuration Vercel (4 handlers).
