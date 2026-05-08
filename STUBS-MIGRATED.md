# 5 Critical Stubs — Real Implementation

Status: 5/5 implementados, build passa.

## Resumo

| Handler | LOC final | Status | Observações |
|---|---|---|---|
| `api/_handlers/process-automations.ts` | ~620 | ✅ | Engine de automations (cron + RSS + variation rotation + image gen). Algumas ramificações simplificadas — ver "Bloqueios" |
| `api/_handlers/generate-content-v2.ts` | ~470 | ✅ | Texto + imagem (Gemini direto, sem Lovable Gateway) |
| `api/_handlers/kai-content-agent.ts` | ~210 | ✅ | Full prompt-builder (substituiu versão simplified) |
| `api/_handlers/generate-image.ts` | ~165 | ✅ | Novo — Gemini 2.5 Flash Image + Vercel Blob upload |
| `api/_handlers/kai-chat-stream.ts` | ~155 | ✅ | Novo — chat genérico Gemini com SSE opcional |

## Helpers portados pra `api/_lib/shared/`

| Arquivo | Origem | Mudanças |
|---|---|---|
| `format-schemas.ts` | copy-paste | nenhuma (puro TS) |
| `quality-rules.ts` | copy-paste | nenhuma (puro TS) |
| `format-rules.ts` | copy-paste | nenhuma (puro TS) |
| `format-constants.ts` | copy-paste | nenhuma (puro TS) |
| `knowledge-loader.ts` | reescrito | Supabase client → Neon `query()`/`queryOne()`. Mesma assinatura pública. |
| `prompt-builder.ts` | reescrito | imports `.js` (ESM Vercel), modelo complexo `gemini-2.5-pro` (era `gemini-2.5-pro-preview-06-05`). |
| `ai-usage.ts` | reescrito | createClient supabase → Neon pool direto. Schema de fallback (model vs model_name) suportado. |

## Convenções respeitadas

- Imports `.js` (ESM) ✅
- `authedPost` / handlers individuais com `tryAuth` quando precisa ser chamável internamente sem auth ✅
- Neon `getPool()` / `query()` / `queryOne()` / `insertRow()` ✅
- Vercel Blob `put()` para upload de imagens ✅
- Logging via `logAIUsage()` em todas as chamadas LLM ✅
- TS strict — passa typecheck completo ✅

## Deps adicionadas

Nenhuma. Tudo já estava no `package.json`:
- `@google/generative-ai` — não usado, optei por `fetch` direto pra Gemini REST (consistente com outros handlers)
- `openai` — disponível mas não foi necessário aqui
- `@vercel/blob` — usado em `generate-image.ts` e `generate-content-v2.ts` (image branch)

## Bloqueios / simplificações

### `process-automations.ts`

1. **Branch `viral_carousel` removido** — chamava `generate-viral-carousel` que ainda é stub 501. Caso o automation tenha `content_type='viral_carousel'`, ele cai no fluxo padrão (text gen + planning_item create). Quando `generate-viral-carousel` for migrado, restaurar o branch.

2. **Deep research para newsletters removido** — chamava `research-newsletter-topic` (stub 501). Newsletters geram com contexto enriquecido normal; não há briefing de pesquisa em tempo real.

3. **YouTube transcription inline removida** — chamava `youtube-transcribe` (não migrado). Se o RSS tiver link YouTube, o conteúdo do feed é usado; transcrição não acontece automaticamente.

4. **Firecrawl scrape para non-RSS links** — não portado. Helper `scrapeContentFromUrl` removido.

5. **Manual test em background (`EdgeRuntime.waitUntil`)** — Vercel não tem equivalente. Manual test agora roda síncrono. Risco: timeout 60s pode ser atingido em automation muito pesada (texto + imagem + publish). Para automations longas, recomendar quebrar em steps ou usar Vercel Workflow. (Cron schedule normal não tem esse problema porque processa 1 ou poucas automations por chamada.)

6. **Variation categories abreviadas** — copiei só os top 4 de cada categoria (vs 8+ no original). As instructions são mais curtas; resultado similar mas menos diversidade. Em produção, repopular a partir do original se notar repetição.

7. **`unified-content-api` substituído por chamada direta ao Gemini** — o original delegava pra unified-content-api (com review/strict_validation). Como esse endpoint ainda é stub, gero direto e aplico cleanContentOutput pra remover labels. Quando unified-content-api for migrado, recomendar adaptar.

### `generate-content-v2.ts`

1. **Lovable AI Gateway substituído por Gemini direto** — image gen agora usa `gemini-2.5-flash-image-preview` direto. Modelo pro `gemini-3-pro-image-preview` ainda existe mas não foi configurado como condicional (sempre usa flash-image). Trocar para pro quando custo/qualidade exigir.

2. **OCR retry removido** — original tinha auto-retry de 2x com OCR validation se `noText=true`. Como não há OCR validation disponível, simplifiquei para 2 tentativas naked + trust no prompt emphatic.

3. **Storage path** — `generated/<userId>/<timestamp>.<ext>` continua dentro do bucket virtual `client-files` (path prefix em Blob).

### `generate-image.ts`

1. **Modelo único** — `gemini-2.5-flash-image-preview`. Não há fallback para DALL-E ou Imagen 4 (que precisariam OPENAI_API_KEY ou Vertex AI setup). Para variações de prompt+ref simples, é suficiente.

2. **Sem persistência DB** — handler retorna apenas `imageUrl`. O frontend (ImageGallery.tsx) já espera isso e persiste em separado via outra rota se necessário.

### `kai-chat-stream.ts`

Função nova, simples — apenas envia mensagens ao Gemini. Não carrega contexto de cliente nem usa prompt-builder. Adequado pra utilities tipo "extrair keywords do conteúdo" (uso atual em ViralSequenceTab).

### `kai-content-agent.ts`

Versão completa substituiu versão SIMPLIFIED. Agora usa `buildWriterSystemPrompt` com voice profile, library, top performers, global knowledge, success patterns, checklist. Streaming SSE preservado.

## Build status

```
$ bun run build
✓ built in 7.15s
```

TypeScript typecheck dos 5 handlers + helpers shared:
```
$ bunx tsc --noEmit --strict ... api/_lib/**/*.ts api/_handlers/<5>.ts
(passa sem erros)
```

(Há 1 erro pré-existente em `validate-social-credentials.ts` linha 29 — não tocado por este trabalho.)

## Próximos stubs prioritários

Pra desbloquear paridade total com automations:
- `generate-viral-carousel` (chamado pelo process-automations branch viral_carousel)
- `research-newsletter-topic` (chamado para newsletters)
- `unified-content-api` (orquestrador com review)
- `late-post` (publicação real Late API — atualmente process-automations chama mas nada acontece se for stub)
- `telegram-notify` (notificação após gen — best-effort, falha silenciosamente)

## Variáveis de ambiente necessárias

| Var | Usada por |
|---|---|
| `DATABASE_URL` | Neon pool (todas) |
| `GOOGLE_AI_STUDIO_API_KEY` | Gemini text + image (4 dos 5) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload (generate-image, generate-content-v2) |
| `CRON_SECRET` (opcional) | process-automations: aceita `Authorization: Bearer <secret>` para invocação cron |
| `NEON_JWKS_URL` | auth (já configurado) |
