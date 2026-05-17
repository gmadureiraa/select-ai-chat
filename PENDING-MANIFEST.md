# Pendências de manifest pro Backend agent — KAI Tasks/Planning fix wave

> Criado em 2026-05-16 pelo agente de Projetos Pessoais durante o fix de Tasks/Planning/Calendar/Notifications.
> Esses são edits em `vercel.json` que precisam do Backend agent aplicar.
> O agente atual NÃO edita `vercel.json` nem `handler-manifest.ts` por contrato — só anota aqui.

## 1. Cron `process-scheduled-posts` precisa rodar a cada 5 minutos

**Hoje:**
```json
{
  "path": "/api/process-scheduled-posts",
  "schedule": "0 12 * * *"
}
```

**Mudar pra:**
```json
{
  "path": "/api/process-scheduled-posts",
  "schedule": "*/5 * * * *"
}
```

**Por quê:** Cron 1x/dia às 12 UTC (9h BR) faz qualquer post agendado fora da janela 9h-15h BR expirar silenciosamente (`status=failed` por `SCHEDULED_POST_MAX_LAG_MINUTES=360`). Posts dentro da janela publicam até ~24h depois. Audit completo em `vault/01 - KALEIDOS/012 - INTERNO/02 - PROJETOS/KAI/audit-2026-05-16/tasks-planning-calendar.md` bug #1.

⚠️ **Antes de aplicar:** garantir que `process-scheduled-posts.ts` use `FOR UPDATE SKIP LOCKED` no SELECT de pickup, ou seja idempotente, pra evitar double-publish quando 2 invocations correm em paralelo (cron 5min + retry).

---

## 2. Cron novo: `process-push-queue` a cada 5 minutos

**Hoje:** Não está no `vercel.json`. Fila `push_notification_queue` empilha rows e **nunca drena**. Push notifications nunca chegam ao dispositivo.

**Adicionar:**
```json
{
  "path": "/api/process-push-queue",
  "schedule": "*/5 * * * *"
}
```

**Verificar antes de aplicar:** o handler `api/_handlers/process-push-queue.ts` aceita GET (cron envia GET). Se rejeitar 405, ajustar handler também.

---

## 3. Cron novo: `process-email-notifications` a cada 5 minutos

**Hoje:** Não está no `vercel.json`. Mesma fila empilhando — `email_notification_queue`. Nenhum email transacional sai.

**Adicionar:**
```json
{
  "path": "/api/process-email-notifications",
  "schedule": "*/5 * * * *"
}
```

**Verificar antes de aplicar:** handler aceita GET.

---

## 4. (Sugestão) Cron `send-publish-reminders` aumentar pra 2x/dia

**Hoje:** `0 9 * * *` (1x/dia 9 UTC = 6h BR).

**Sugestão:** `0 9,17 * * *` (manhã e tarde).

Não-bloqueante — já corrigi o bug do 405 no handler (aceitar GET). Schedule fica a critério do Backend agent.

---

## 5. (Sugestão) `process-due-date-notifications` rodar 2x/dia

**Hoje:** `30 9 * * *` (1x/dia).

**Sugestão:** `0 9,15 * * *` (cobre quem ajusta tarefa durante o dia).

Não-bloqueante.

---

## Resumo do que precisa entrar no `vercel.json` crons array

```json
{
  "path": "/api/process-scheduled-posts",
  "schedule": "*/5 * * * *"
},
{
  "path": "/api/process-push-queue",
  "schedule": "*/5 * * * *"
},
{
  "path": "/api/process-email-notifications",
  "schedule": "*/5 * * * *"
}
```

⚠️ Vercel Hobby tem limite de 2 crons. Se o projeto estiver no Hobby, precisa upgrade pra Pro (que permite cron-per-minute granularity). Verificar plano antes de aplicar.

---

## Fixes complementares JÁ APLICADOS pelo agente Tasks/Planning

- `api/_handlers/send-publish-reminders.ts` — aceita GET (cron-only check via `x-vercel-cron`).
- `api/_handlers/process-recurring-content.ts` — passa `Authorization: Bearer ${CRON_SECRET}` no callInternal pra AI gen funcionar.
- `api/_handlers/send-push-notification.ts` — diferencia exception (mantém subscription) de 404/410 (deleta). Usa helper compartilhado `sendWebPush` que retorna `{success, statusCode, error}`.
- Migration nova `0041_notifications_add_link_column.sql` — adiciona coluna `link text` em `notifications` pros triggers `notify_team_task_*` funcionarem.
- Migration nova `0042_drop_legacy_team_task_assignment_trigger.sql` — droppa `trg_notify_team_task_assignment` legado pra evitar duplicação de notif.
- Migration nova `0043_scheduled_posts_consolidate.sql` — adiciona colunas faltantes na tabela `scheduled_posts` antiga (`workspace_id`, `external_post_id`, `retry_count`, `media_urls`, `metadata`, `external_post_id`).
- Migration nova `0044_task_due_date_notifications.sql` — função `create_task_due_date_notifications()` que processa `team_tasks.due_date` e cria notif `task_due_soon`.
- `process-due-date-notifications.ts` — chama tambm `create_task_due_date_notifications()`.
- `src/hooks/useNotifications.ts` — `NotificationType` estendido com `task_assigned | task_mention | task_due_soon | task_comment`.
- `src/components/notifications/NotificationBell.tsx` — `typeIcons` + `typeColors` cobrem os 4 tipos novos.
- `src/hooks/useNotificationPreferences.ts` — escreve na tabela `notification_preferences` (nova) em vez do JSONB legado.
- `src/hooks/useTeamTasks.ts` — `useQuery` agora filtra `is_recurrence_template = false` por padrão (templates só aparecem em view dedicada).
- `src/hooks/usePlanningItems.ts` — idem `usePlanningItems` filtra templates.

---

# Pendências da onda Clients/Brand/Voice — 2026-05-16

> Adicionado pelo agente de Projetos Pessoais durante o fix Clients/Brand.

## Handlers novos a criar

### `client-document-create`
- **Usado hoje em:** `src/components/clients/ClientCreationWizardSimplified.tsx`
  (`supabase.from("client_documents").insert(...)` direto, ~linha 135)
- **O que faz:** receber `{ client_id, name, file_type, file_path }`, validar
  acesso ao cliente, inserir em `client_documents`.
- **Auth:** `authedPost` + `assertClientAccess(user.id, client_id)`.
- **Payload sugerido:**
  ```ts
  z.object({
    client_id: z.string().uuid(),
    name: z.string().min(1).max(500),
    file_type: z.string().max(120).nullable().optional(),
    file_path: z.string().min(1).max(2048),
  });
  ```
- **Vercel:** adicionar entrada em `handler-manifest.ts` apontando pra
  `api/_handlers/client-document-create.ts`. Sem cron.

### `client-website-{create,update,delete}` (ou expandir `client-update`)
- Hoje: `src/hooks/useClientWebsites.ts` faz tudo direto via `supabase`.
- Sugerido: 3 handlers separados OU um payload `websites: Website[]` em
  `/api/client-update` que faz upsert em massa numa transacao.

### `client-reference-{create,update,delete}`
- Hoje: `src/hooks/useReferenceLibrary.ts` faz INSERT/UPDATE/DELETE em
  `client_reference_library` direto.
- ATENCAO: hook tambem chama RPC `log_user_activity` que pode nao existir
  no Neon (verificar antes).

### `client-visual-reference-create`
- Hoje: `src/hooks/useClientVisualReferences.ts` faz INSERT direto em
  `client_visual_references` E auto-dispara `analyze-style` (caro). Migrar
  pra handler que aplique feature-flag/rate-limit.

## Hooks/components ainda em direct supabase (P0+P1 nao migrados)

- `src/components/clients/AIContextTab.tsx` — `supabase.from("clients").select(voice_profile, content_guidelines)`.
  Trocar por `useClientContext` (que ja retorna voice_profile) + handler novo
  pra content_guidelines OU expandir `client-context` pra incluir.
- `src/components/clients/ClientAnalyticsTab.tsx` — query direta em `clients`
  (audit menciona linhas 106-114).
- `src/components/onboarding/OnboardingFlow.tsx` — step `client` ja herdou
  o fix via `useClients` migrado. Verificar steps adicionais.

## Wizards duplicados (P1, NAO unificado nessa onda)

`ClientCreationWizardSimplified` (2-step, sidebar) vs `ClientOnboardingWizard`
(5-step, rota `/clients`). Cliente criado pelo sidebar nao ganha preferences/
refs/social import. Decisao pendente: unificar ou separar explicitamente.
Custo: 4-8h.

## Pillars singular — DONE nesta onda

- Frontend: `useClientOnboarding.ts` insere `content_pillar` (singular)
  uma row por pilar (commit `df6ed9fc`).
- Backfill: `migrations/0041_backfill_content_pillars_singular.sql` +
  espelho em `supabase/migrations/20260516130000_*.sql`.
- ⚠️ **Backend agent rodar a migration 0041 em prod** apos conferir
  count de rows legacy:
  ```sql
  SELECT count(*) FROM client_preferences WHERE preference_type = 'content_pillars';
  ```

## Voice profile auth — DONE nesta onda

- `api/_handlers/generate-voice-profile.ts` saiu de `anonPost` pra
  `authedPost` + `assertClientAccess` (commit `881f33e6`). Sem alteracao
  no manifest necessaria — o handler ja estava la.

## client-update extended — DONE nesta onda

- `api/_handlers/client-update.ts` agora aceita `brand_assets` e
  `ai_analysis` (commit `4af29cb9`). Sem alteracao no manifest.

---

# Pendências da onda Library/References — 2026-05-16

> Adicionado pelo agente de Projetos Pessoais após o fix wave Library/Refs
> (commits `df9e4b3c` e `7d74ef92`).

## Sem mudanças necessárias no `vercel.json` ou `handler-manifest.ts`

Todos os endpoints fixados nesta onda já estavam declarados no manifest e
mantiveram o método (POST). Mudanças foram:
- 3 handlers passaram de `anonPost` pra `authedPost` (firecrawl-scrape,
  scrape-newsletter, fetch-rss-feed). Auth agora é obrigatória — Vercel
  não precisa de nada, mas qualquer caller frontend que estivesse chamando
  sem token (não deve existir, mas vale grep) vai começar a receber 401.
- `image-search` também migrou pra `authedPost` (era usado pelo adapter
  `images.ts` que ainda é o entry point sem auth direta — mas `images.ts`
  só repassa pra image-search/generate-image, ambos agora authed).
- `radar-img-proxy` continua aberto (sem JWT) porque Performance v2 renderiza
  thumbs IG sem login, mas ganhou rate-limit por IP.

## Observações pro Backend agent

1. **Rate-limit é in-memory.** Vale por container/invocation Vercel, não
   compartilha entre cold starts. Pra hardening real precisa Upstash Redis
   (REDIS_URL no env + lib `@upstash/ratelimit`). Tracking pendente.

2. **process-knowledge agora requer `OPENAI_API_KEY`** pra embedding (1536
   dims) e `GOOGLE_AI_STUDIO_API_KEY` pra summary (via callLLM). Removi
   dependência do deprecated `LOVABLE_API_KEY`. Verificar que ambas estão
   no Vercel env do projeto.

3. **batch-transcribe / cron-transcribe** agora ignoram `images` legados
   (paths Supabase Storage). Se houver linhas órfãs em `instagram_posts`
   com `images: ['client-files/xxx.jpg']` sem `thumbnail_url`, vão pular
   transcrição. Pode rodar backfill `UPDATE ... SET images = NULL WHERE
   ...` se quiser limpar.

4. **useUnifiedContent**: removi as queries em `twitter_posts` e
   `linkedin_posts` (tabelas órfãs). Quando reativar tabelas per-client
   (provavelmente via Metricool sync), descomenta o bloco e aponta pro
   shape novo.

---

# Pendências da onda AI/Workflows/Chat — 2026-05-16

> Adicionado pelo agente de Projetos Pessoais durante o fix AI/Workflows/Chat
> P0. Contexto completo: `vault/01 - KALEIDOS/012 - INTERNO/02 - PROJETOS/KAI/audit-2026-05-16/ai-workflows-chat.md`.

## 1. Cron pra `run-madureira-workflows-daily` (NOVO — bloqueante)

**Hoje:** `cron-radar-master` (que disparava esse handler diariamente) FOI
DELETADO no commit `e4575fce` (remove Reels Viral + Radar Viral). Restou só
`ai-workflow-trigger` que é botão de teste manual.

Resultado: os 10 workflows Madureira do agent `madureira-redes` (carrosséis IG,
LinkedIn posts, threads X, batches TikTok, etc) NÃO disparam mais
automaticamente. Cards de planning não nascem sozinhos no calendário do
Madureira.

**Adicionar ao `vercel.json` crons array:**
```json
{
  "path": "/api/run-madureira-workflows-daily",
  "schedule": "0 10 * * *"
}
```

7am BR = 10 UTC. Handler já valida `x-vercel-cron` OR `Bearer ${CRON_SECRET}`
em `run-madureira-workflows-daily.ts:447-450`.

**maxDuration:** o handler roda 4 workflows × ~7-8s cada via Gemini = ~30s.
Como hoje todo handler vai pelo `/api/router.ts` que tem `maxDuration: 60`
(vercel.json:27), já cabe sem ajuste.

⚠️ Vercel Hobby tem limite de 2 crons. Combinar com os 3 outros novos
(process-scheduled-posts, process-push-queue, process-email-notifications)
exige upgrade pra Pro (limite 40 crons/min granularity).

## 2. Handler `analyzeViralReel` morto — tool registrada sem destino

`api/_lib/kai-chat-tools/analyzeViralReel.ts` continua registrada na lista de
tools do KAI Chat (`kai-simple-chat.ts:2270`) e aponta pra
`/api/adapt-viral-reel` que foi DELETADO no commit `e4575fce`. Qualquer
chamada da tool no chat retorna fetch network error.

**Opções:**
- **A.** Remover do registry (`kai-simple-chat.ts:2270`) + remover do system
  prompt (`kai-simple-chat.ts:2153, 2163`) + deletar
  `api/_lib/kai-chat-tools/analyzeViralReel.ts` + remover `analyzeViralReelTool`
  do `api/_lib/kai-chat-tools/index.ts`. Limpa morto.
- **B.** Tool vira stub que devolve mensagem "use https://reels.kaleidos.com.br
  pra essa feature". Mantém função pra futura re-integração.

Mesma decisão pra `createRadarBriefTool` (handler `generate-radar-brief`
também deletado).

Recomendação: **opção A** — código morto polui e a tool nunca vai gerar valor
sem o handler. Backend agent decide e remove na próxima onda.

## 3. handler-manifest entry pra `run-madureira-workflows-daily`

Já existe (`handler-manifest.ts:111`). Sem ação necessária — só ativar o cron
acima.
