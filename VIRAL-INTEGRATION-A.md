# VIRAL-INTEGRATION — Fase A.1 + A.3 (backend + hook)

**Data:** 2026-05-08
**Branch:** `combo-viral-integration`
**Agente:** VIRAL-INTEGRATION-BACKEND
**Status:** done — build passa, sem commit

Esta fase entrega o **carregamento de contexto multi-tenant** que destrava as
Fases B+ do plano em `VIRAL-INTEGRATION-PLAN.md`. Os 3 handlers principais
(`generate-viral-carousel`, `adapt-viral-reel`, `kai-content-agent`) agora
recebem `clientId` no body e injetam tom/pillars/persona/brand/keywords/
competidores no system prompt do Gemini.

---

## 1. Arquitetura

### 1.1 Source of truth — `ClientContext` shape
Tipos espelhados entre client e server pra evitar drift:

```
src/hooks/useClientContext.ts          ← TanStack Query hook (frontend)
api/_lib/shared/client-context.ts      ← server-side aggregator
```

Ambos usam o mesmo `decodeClientContext(raw)` puro pra transformar key/value
de `client_preferences` em campos tipados (`tone`, `pillars`, `persona`,
`brand`).

Mapeamento de `preference_type` → campo do `ClientContext`:

| preference_type   | campo                  |
|-------------------|------------------------|
| `tone`            | `tone` (string)        |
| `content_pillar`  | `pillars[]`            |
| `persona_age`     | `persona.age`          |
| `persona_pain`    | `persona.pain`         |
| `persona_goal`    | `persona.goal`         |
| `brand_do`        | `brand.do[]`           |
| `brand_dont`      | `brand.dont[]`         |
| `target_audience` | `audience[]`           |

### 1.2 Helpers de prompt

`buildClientPromptContext(ctx)` retorna um bloco markdown pronto pra prefixar
no system prompt — cobre nome/indústria/voz/pilares/persona/brand do/dont/
keywords/competitors + `identity_guide` truncado.

`buildClientHistoricalReferences(ctx, n)` pega top N de `contentLibrary`
(prefere `is_favorite`, depois engagement em `metadata.likes/comments/shares/views`)
e formata como bloco "REFERÊNCIAS HISTÓRICAS DESTE CLIENTE".

---

## 2. Files criados

| Arquivo | LOC | Função |
|---|---|---|
| `api/_lib/shared/client-context.ts` | 332 | Server-side aggregator + buildClientPromptContext + buildClientHistoricalReferences |
| `api/_handlers/client-context.ts` | 67 | GET /api/client-context (auth + workspace_member/super_admin gate) |
| `src/hooks/useClientContext.ts` | 248 | TanStack Query hook (8 queries paralelas via supabase.from) |
| `e2e/07-client-context.spec.ts` | 41 | Smoke tests (401 sem auth, 401 com Bearer inválido, 405 em POST) |
| `VIRAL-INTEGRATION-A.md` | this file | Documentação da fase |

## 3. Files modificados

| Arquivo | LOC delta | Mudança |
|---|---|---|
| `src/hooks/useClientContext.ts` (legacy) | renamed → `useClientContextGenerator.ts` | Hook antigo de mutation continua existindo, novo nome reflete função (gerar identity guide via Gemini) |
| `src/components/clients/AIContextTab.tsx` | +1/-1 | Atualiza import pro novo nome |
| `src/hooks/useClientContextGenerator.ts` | +8/-1 | Adiciona docstring distinguindo dos dois hooks |
| `api/_handlers/generate-viral-carousel.ts` | +20/-2 | Carrega `getClientContextServer` + injeta no prompt + tone fallback do client_preferences |
| `api/_handlers/adapt-viral-reel.ts` | +18/-2 | Prepend client context block no `briefingText` antes de mandar pro Gemini |
| `api/_handlers/kai-content-agent.ts` | +18/-2 | Adiciona viral context layer ON TOP do `buildWriterSystemPrompt` existente |
| `api/_handlers/cron-generate-daily-brief.ts` | +25/-5 | Filtro de news por `client_viral_keywords` + injeção de prompt context per-client |
| `api/handler-manifest.ts` | +1 | Registra `client-context` |

**Total:** ~750 LOC novas + 7 arquivos modificados.

---

## 4. Comportamento

### 4.1 generate-viral-carousel
Antes:
```
prompt = buildPrompt(briefing, slideCount, tone)
```

Depois:
```
clientContext = await getClientContextServer(clientId)  // fail-soft
effectiveTone = body.tone ?? clientContext.tone
prompt = buildPrompt(briefing, slideCount, effectiveTone, clientContext)
       = clientPromptBlock + historicalRefsBlock + "---" + corePrompt
```

Retro-compat: se `clientContext` é null ou vazio (cliente novo, sem prefs),
o prefix é vazio e o prompt cai exatamente no comportamento legacy.

### 4.2 adapt-viral-reel
O `briefingText` que vai junto do vídeo no Gemini agora é prefixado com:
```
# CONTEXTO DO CLIENTE
- Indústria: ...
- Voz: ...
- Pilares: ...
- Persona: ...
- ...

## REFERÊNCIAS HISTÓRICAS DESTE CLIENTE
### Exemplo 1 — Title (carousel)
...

---

BRIEFING DO USUÁRIO:
- Tema: ...
```

Isso muda a instrução final pra "ADAPTANDO o conteúdo à voz/nicho/persona
do cliente acima" — Gemini usa contexto pra escolher exemplos do nicho certo.

### 4.3 kai-content-agent
Mantém todo o pipeline existente (`buildWriterSystemPrompt` que já carrega
voice profile, library, top performers). Adiciona uma camada nova ENTRE o
system prompt e o platform suffix:
```
fullSystemPrompt = systemPrompt
                 + viralContextBlock        // novo
                 + viralHistoricalBlock     // novo
                 + platformSuffix
```

`viralContextBlock` traz especificamente os campos que faltavam:
`client_viral_keywords`, `client_viral_competitors`, e os
`client_preferences.brand_do/brand_dont` que `buildWriterSystemPrompt`
não lia.

### 4.4 cron-generate-daily-brief
Ainda é per-cliente (já era — loop por client em `pickClientsWithSources`).
Mudanças:

1. **Filtro de news por keywords**: se o cliente tem `client_viral_keywords`,
   `viral_news_articles` é filtrado por título/summary `ILIKE %keyword%`.
   Sem keywords, comportamento legacy (filtra só por niche).
2. **Prompt enriquecido com context**: `buildPrompt` agora aceita um
   `contextBlock` que é prependado, dando ao Gemini voz/pilares/persona/
   competitors do cliente pra calibrar narrativas e carousel_ideas.

### 4.5 GET /api/client-context
- Requer Bearer JWT.
- Autoriza via `workspace_members` (cliente do workspace do user) OU
  `super_admins`.
- 200 → `{ ok: true, context: ClientContext }`
- 400 → falta `client_id`
- 401 → sem auth
- 403 → user não tem acesso ao client
- 404 → client_id não existe
- 405 → método != GET

---

## 5. Build status

```
$ bun run build
✓ built in 10.32s
(warnings só de chunk size — pré-existentes, não relacionados)
```

E2E novo (`07-client-context.spec.ts`): 3 testes que rodam offline contra
o handler.

---

## 6. NÃO foi feito (escopo de outros agentes)

- ❌ Pre-fill UI dos viral tabs (briefing panel SV, ContextSidebar Reels,
  NicheBar Radar) — outro agente vai fazer Fase A.2
- ❌ Zustand store `viral-context.ts` pra bridge cross-tab — Fase B
- ❌ Auto-save `planning_items` quando viral output é salvo — Fase C
- ❌ Embeddings em `client_content_library` — Fase D
- ❌ `cron-radar-master` per-client scraping — Fase E
- ❌ Permissões + plan limits — Fase F

---

## 7. Critério de pronto (todos verdes)

- [x] `useClientContext` hook funcional + tipado
- [x] `getClientContextServer` + helpers no backend
- [x] 3 handlers principais aceitam clientId e injetam context
- [x] `cron-generate-daily-brief` per-client (com keywords filter)
- [x] `GET /api/client-context` endpoint criado
- [x] 1 E2E test
- [x] `bun run build` passa
- [x] Documento `VIRAL-INTEGRATION-A.md`
- [x] Não commitado

---

## 8. Próximos passos sugeridos

1. **Agente UI** pode começar Fase A.2 — pre-fill SV/Reels/Radar com
   `useClientContext(clientId).data`.
2. **Migração 0009** (embeddings) pode rodar em paralelo com Fase B.
3. **Seed de `client_preferences` pra DEFIVERSO** (test client) ajuda a
   validar o pipeline E2E real.
