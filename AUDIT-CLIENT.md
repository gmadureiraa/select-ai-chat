# AUDIT-CLIENT.md — Frontend (`src/`) audit

**Branch:** `combo-viral-integration`
**Data:** 2026-05-07
**Agente:** AUDIT
**Escopo:** somente `src/`. `api/` é responsabilidade de outro agente.

---

## Resultado executivo

- `bun run build` -> **PASSA** (Vite 5.4.19, 4993 modules transformed, ~6s)
- `bunx tsc --noEmit -p tsconfig.app.json` -> **0 erros**
- `bunx tsc --noEmit` (raiz) -> **0 erros**
- Hardcodes legacy de URL Supabase -> **0 ocorrências reais** (1 hit em comentário descritivo de regex de host de imagem)
- `supabase.functions.invoke` -> **0** (apenas 1 menção em comentário de doc)
- `supabase.storage.*` -> **0**
- `supabase.channel(` / realtime / `postgres_changes` -> **0** (já migrado para polling em `usePlanningRealtime`)

---

## Mudanças aplicadas

### 1. Edge functions Supabase -> Vercel Functions (`/api/...`)

Todas as chamadas que ainda apontavam para `${VITE_SUPABASE_URL}/functions/v1/<func>` foram trocadas por `/api/<func>`:

| Arquivo | Endpoint |
|---|---|
| `src/components/settings/WebhookSettings.tsx` | `late-webhook` (URL absoluta com `window.location.origin` para webhooks externos da Late) |
| `src/components/kai/viral-sequence/generateCopy.ts` | `kai-content-agent` |
| `src/hooks/useMaterialChat.ts` | `kai-simple-chat` |
| `src/hooks/useKAISimpleChat.ts` | `kai-simple-chat` |
| `src/lib/parseOpenAIStream.ts` | `kai-content-agent` |

Em todos os casos removi também o header `apikey: VITE_SUPABASE_PUBLISHABLE_KEY` que não tem propósito no Vercel Function.

### 2. Storage Supabase -> Vercel Blob

- `src/components/performance/PostContentSyncButton.tsx`: a construção manual de URL `${supabaseUrl}/storage/v1/object/public/client-files/...` foi substituída por `blobStorage.from('client-files').getPublicUrl(uploadedPaths[0])`. Import `blobStorage` adicionado.

### 3. ClickUp import hook

- `src/hooks/useClickUpImport.ts`: removido import e chamada quebrada de `apiInvoke('import-clickup', { method: 'GET', ... })` que causava o único TS error (`'method' does not exist in type 'InvokeOptions'`). O hook já tinha o caminho correto (`fetch('/api/import-clickup?action=...')`), o `apiInvoke` era resíduo.

### 4. Auditoria de imports

- `lovable.auth.signInWithOAuth` (`Login.tsx`, `SimpleSignup.tsx`) já delega corretamente para `neonAuth.signInWithOAuth` via shim em `src/integrations/lovable/index.ts`. Não precisou mexer.
- `useAuth.ts` continua usando `supabase.auth.*` que é o `SupabaseAuthAdapter` do Neon Auth. Sem refactor necessário.

---

## Estado dos clientes/integrações

### `src/integrations/supabase/client.ts`
- Exporta `supabase` apontando para Neon Data API (PostgREST) via `VITE_SUPABASE_URL`.
- `auth` substituído pelo `neonAuth` (SupabaseAuthAdapter).
- `fetchWithNeonAuth` injeta o JWT do Neon Auth em todas as requisições.

### `src/integrations/neon-auth/client.ts`
- `neonAuth` criado com `createAuthClient(VITE_NEON_AUTH_URL)` + `SupabaseAuthAdapter()`.
- `getNeonAuthJWT()` lê o access token da sessão atual.

### `src/integrations/storage/blob-client.ts`
- `blobStorage.from(bucket)` substitui `supabase.storage.from(bucket)`. Bate com a API esperada pelos call sites (upload, getPublicUrl, createSignedUrl, list, remove, download).
- Depende de endpoints `/api/blob/*` que outro agente está implementando.

### `src/lib/apiInvoke.ts`
- Substitui `supabase.functions.invoke('name', { body })`. Mesma assinatura `{ data, error }`.
- Já existia `apiInvokeStream` para SSE.

### `src/integrations/lovable/index.ts`
- Shim que mantém `lovable.auth.signInWithOAuth(provider, opts)` delegando para `neonAuth.signInWithOAuth`.

---

## Itens deferidos / dependências externas

### RPCs Postgres usadas (precisam existir no Neon)
Listei os 6 nomes de RPC encontrados — outro agente precisa garantir que existem na DB Neon migrada:

- `initialize_kanban_columns(p_workspace_id)` (`useKanbanBoard.ts`, `usePlanningItems.ts`)
- `accept_pending_invite(...)` (`Login.tsx`, `SimpleSignup.tsx`, `WorkspaceLogin.tsx`, `NoWorkspacePage.tsx`, `WorkspaceGuard.tsx`)
- `add_workspace_member_or_invite(...)` (`useTeamMembers.ts`)
- `get_my_pending_workspace_invites()` (`Login.tsx`, `SimpleSignup.tsx`, `NoWorkspacePage.tsx`)
- `get_user_workspace_slug(p_user_id)` (`Login.tsx`)
- `log_user_activity(...)` (`useReferenceLibrary.ts`, `useContentLibrary.ts`)

Se esses não existirem no Neon, esses fluxos vão falhar silenciosamente (RPC retorna erro mas a maioria dos call sites trata `error` graciosamente).

### Endpoints `/api/*` chamados pelo client (responsabilidade do agente do `api/`)

Lista observada de funções que o front consome — verificar se cada uma tem handler em `api/_handlers/` ou rota direta:

- `api/blob/upload-token`, `/api/blob/delete`, `/api/blob/list`, `/api/blob/signed-url`, `/api/blob/download`
- `api/late-webhook`
- `api/kai-content-agent` (SSE)
- `api/kai-simple-chat` (SSE)
- `api/extract-instagram`
- `api/transcribe-media`
- `api/import-clickup` (query string `?action=discover|import`, `GET` para discover)
- demais funções consumidas via `apiInvoke(...)` em hooks (search by `apiInvoke('` no projeto: `extract-instagram`, `transcribe-media`, etc).

### `parseOpenAIStream.ts`
Esperava resposta do Lovable AI gateway. Como agora vai bater em `/api/kai-content-agent`, o Vercel Function precisa responder com SSE no mesmo formato OpenAI delta (`data: {choices:[{delta:{content:"..."}}]}\n\n`). Documentei só por garantia.

---

## TS errors triados (final state: 0)

Antes desta auditoria havia 1 erro TS:

```
src/hooks/useClickUpImport.ts(42,9): error TS2353: Object literal may only specify known properties, and 'method' does not exist in type 'InvokeOptions'.
```

**Fix:** ver seção 3 acima. Erro decorrente de migração incompleta — `apiInvoke` não suporta `method` (sempre POST), e o hook já tinha o `fetch` direto correto logo abaixo.

Após o fix: `tsc --noEmit -p tsconfig.app.json` retorna 0 linhas.

---

## Build status final

```
✓ 4993 modules transformed.
✓ built in 5.85s

dist/index.html                                 2.19 kB
dist/assets/index-Y_f1kcqE.css                161.37 kB
dist/assets/index-BEHFeFra.js               4,128.16 kB
```

Único warning: chunk maior que 500kB. Pré-existente, não bloqueia. Sugestão de melhoria futura: code splitting com `React.lazy` nas páginas (`Kai`, `ExportMadureira`).

---

## O que NÃO foi tocado

- Nenhum arquivo dentro de `api/` foi modificado.
- Nenhum commit criado.
- Nenhum arquivo deletado.
- `src/integrations/supabase/types.ts` (158k linhas) mantido — é o gerado do Lovable para typing do PostgREST. Quando o Neon DB for o canônico, regenerar com a CLI do Neon.
