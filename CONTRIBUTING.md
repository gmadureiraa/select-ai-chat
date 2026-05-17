# CONTRIBUTING.md — KAI 2.0

Guia rápido pra desenvolvedores. Ver também [`SETUP.md`](./SETUP.md) (setup do zero), [`ARCHITECTURE.md`](./ARCHITECTURE.md) (visão técnica) e [`ENV-VARS.md`](./ENV-VARS.md).

---

## Como rodar local

```bash
bun install
vercel env pull .env.local --environment=development   # secrets
vercel dev                                              # front + /api juntos
# OU só o front (rápido):
bun run dev
```

Detalhes em [`SETUP.md`](./SETUP.md).

---

## Convenções gerais

### Linguagem
- TypeScript estrito. Sem `any` exceto em escape hatches comentados (ex: tabelas pendentes de codegen).
- ESM nativo. **Imports relativos no `api/` precisam ter extensão `.js`** mesmo apontando pra arquivos `.ts` (Node ESM resolution):
  ```ts
  import { query } from '../_lib/db.js';      // ✅ correto
  import { query } from '../_lib/db';          // ❌ runtime error em Vercel
  ```
- No `src/` (Vite/Tailwind), imports usam alias `@/` apontando pra `src/`:
  ```ts
  import { Button } from '@/components/ui/button';
  import { useClients } from '@/hooks/useClients';
  ```

### Naming
- Arquivos:
  - Componentes React → `PascalCase.tsx` (ex: `WorkspaceSettingsTab.tsx`)
  - Hooks → `useCamelCase.ts` (ex: `useTeamMembers.ts`)
  - Handlers API → `kebab-case.ts` (ex: `extract-pdf.ts`, matches o slug `/api/extract-pdf`)
  - Libs → `camelCase.ts`
- DB tables: snake_case plural (`workspace_members`, `viral_news_articles`)
- Branches: `<tipo>/<descricao-kebab>` (ex: `feature/late-publishing`, `fix/jwt-jwks-url`)

### Estilo
- ESLint flat config (`eslint.config.js`) com `react-hooks` + `react-refresh`. Rodar `bun run lint` antes de commitar.
- Tailwind com tokens semânticos (`bg-card`, `text-foreground`, `bg-muted`). Evitar `bg-white`/`text-white` exceto em overlays de imagem.
- Dark mode é forçado (`defaultTheme="dark"`, `enableSystem={false}` em `App.tsx`). Não testar em light.
- Idioma de interface e copy: **português brasileiro**.

### Git
- Branch atual de migração: `combo-viral-integration`. Não commitar nela direto até alinhar com Gabriel.
- Commits em português, formato `<tipo>: <mensagem>` (`feat: …`, `fix: …`, `chore: …`).
- Não amend commits que já foram pushados.
- KAI repo é gerenciado pelo Lovable (gpt-engineer-app[bot]) — combinar antes de mergear em `main`.

---

## Adicionar um novo handler em `api/_handlers/`

Exemplo: criar `/api/my-feature`.

### 1. Criar o arquivo

`api/_handlers/my-feature.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';

interface Body {
  clientId: string;
  prompt: string;
}

export default authedPost(async ({ user, body }) => {
  const { clientId, prompt } = body as Body;

  if (!clientId || !prompt) {
    throw new Error('clientId and prompt are required');
  }

  // Auth já foi validada pelo wrapper. user.id vem do JWT (sub claim).
  const rows = await query<{ id: string; name: string }>(
    `SELECT id, name FROM clients WHERE id = $1 AND owner_user_id = $2`,
    [clientId, user.id]
  );

  if (rows.length === 0) {
    throw new Error('Client not found or no access');
  }

  // ... lógica
  return { ok: true, clientId, results: [] };
});
```

### 2. Registrar no manifest

Adicionar entrada em `api/handler-manifest.ts`:

```ts
'my-feature': () => import('./_handlers/my-feature.js'),
```

> O arquivo é "AUTO-GENERATED" no header mas a auto-geração não está rodando — adicionar manual mesmo.

### 3. Chamar do client

```ts
import { apiInvoke } from '@/lib/apiInvoke';

const { data, error } = await apiInvoke('my-feature', {
  body: { clientId, prompt: 'foo' },
});

if (error) {
  toast.error(error.message);
  return;
}
console.log(data); // { ok: true, clientId, results: [] }
```

### Variantes do wrapper

| Wrapper | Uso |
|---|---|
| `authedPost(fn)` | POST + auth obrigatória + JSON body. Caso default. |
| `anonPost(fn)` | POST + auth opcional. Webhooks públicos, validação CSV, etc. |
| Sem wrapper (raw handler) | OAuth callbacks (GET com query string), SSE custom (`kai-content-agent`, `kai-simple-chat`), webhooks com HMAC custom (`late-webhook`). Importa `applyCors` + `handlePreflight` de `../_lib/cors.js` na unha. |

### SSE (streaming)

Pra streams (LLM tokens, etc.), não use o wrapper — escreva no `res` diretamente:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const user = await tryAuth(req);
  // ... write chunks
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'oi' }}]})}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}
```

No client use `apiInvokeStream(name)` em vez de `apiInvoke()`.

### Stub 503 (feature flag por env var)

Pattern usado quando o handler depende de credencial externa que pode não estar setada:

```ts
const REQUIRED_ENV = ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  return res.status(503).json({
    error: 'LinkedIn integration not configured',
    missing_env: missing,
    hint: 'Add the missing env vars in Vercel and redeploy',
  });
}
// ... lógica real
```

Quando Gabriel adiciona a env e redeploya, o handler ativa sozinho. Ver [`STUBS-MIGRATED-FINAL.md`](./STUBS-MIGRATED-FINAL.md) pros 10 handlers que seguem este pattern.

---

## Adicionar uma nova page (rota)

Editar `src/App.tsx`:

```tsx
const MyPage = lazy(() => import('./pages/MyPage'));

// dentro de <Routes>:
<Route path="/my-page" element={<MyPage />} />
```

Criar `src/pages/MyPage.tsx`:

```tsx
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';

export default function MyPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  // ...
  return <div>...</div>;
}
```

Se a página é restrita ao app principal multi-tenant, prefira adicionar como **tab** em `src/pages/Kai.tsx` em vez de rota top-level. Pattern:

1. Adicionar entrada em `toolTabs` array
2. Adicionar `case "my-tab":` no switch `renderContent()`
3. Lazy import + adicionar item no `KaiSidebar.tsx`
4. Route guard (`isOwner`, `canManageTeam`, `isSuperAdmin`) se aplicável

Exemplo completo: ver as tabs `workspace-settings`, `workspace-members` e `radar-sources-admin`.

---

## Adicionar uma migration

1. Criar `migrations/000<N>_descricao.sql`. Numerar sequencialmente.
2. Aplicar no Neon:
   ```bash
   psql "$DATABASE_URL" -f migrations/000<N>_descricao.sql
   ```
3. Idempotência: usar `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `INSERT … WHERE NOT EXISTS`.
4. RLS: habilitar (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`) + criar policies (`auth.uid()` continua funcionando — Neon Auth honra esse alias).
5. **TODO global:** introduzir tooling estruturado (drizzle-kit, atlas) — hoje as migrations são SQL puro aplicado manual.

---

## Adicionar uma env var

1. Decidir: server-only (`MY_KEY`) ou client (`VITE_MY_KEY` — vai pro bundle).
2. Adicionar em [`ENV-VARS.md`](./ENV-VARS.md).
3. Setar local em `.env.local` ou via `vercel env add MY_KEY development`.
4. Setar prod via dashboard ou `vercel env add MY_KEY production`.
5. Redeploy: `vercel deploy --prod`.

---

## Hooks de data (TanStack Query)

Convenção:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useClients(workspaceId?: string) {
  return useQuery({
    queryKey: ['clients', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

Polling (em vez de Realtime WS):

```ts
useQuery({
  queryKey: ['team-tasks', workspaceId],
  refetchInterval: 15_000,             // 15s
  queryFn: async () => { /* ... */ },
});
```

Mutation com toast de erro:

```ts
import { toast } from 'sonner';

useMutation({
  mutationFn: async (input) => { /* ... */ },
  onError: (err) => toast.error(err.message ?? 'Erro inesperado'),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['x'] }),
});
```

---

## Testes

Playwright pra E2E:

```bash
bunx playwright test
```

Config em `playwright.config.ts`. Fixtures em `playwright-fixture.ts`.

Não há suíte de unit tests configurada hoje — adicionar Vitest se necessário.

---

## Build local antes de PR

```bash
bun run build                                    # vite build
bunx tsc --noEmit -p tsconfig.app.json           # type-check (0 erros esperados)
bun run lint                                     # eslint
bun run lhci                                     # Lighthouse gate (ver seção abaixo)
```

Se algum dos 4 falhar, **não pushar**.

---

## Lighthouse CI — gate de PRs (a11y ≥ 95, perf ≥ 70)

Todo PR pra `main` ou `combo-viral-integration` roda Lighthouse (desktop) contra `/login` e `/signup` via `.github/workflows/lighthouse.yml`.

### Thresholds (definidos em `.lighthouserc.json`)

| Categoria       | Mínimo | Severidade |
|-----------------|--------|------------|
| Accessibility   | 0.95   | **error**  |
| Performance     | 0.70   | warn       |
| Best Practices  | 0.90   | warn       |
| SEO             | 0.85   | warn       |

**Accessibility é o único gate bloqueante.** O resto avisa mas não trava o merge (regressão ainda fica visível no log do workflow + artifact). A meta é manter a11y ≥ 95 e perf ≥ 70 sem regressões — alteramos os thresholds só com decisão deliberada e nota nesse arquivo.

### Rodar local antes do PR

```bash
bun run build
bun run lhci
```

O `lhci autorun` sobe `bunx vite preview --port 4173 --strictPort`, mede /login + /signup uma vez, valida assertions e sobe os reports em armazenamento público temporário do Google (link sai no stdout).

Artifacts ficam em `.lighthouseci/` (já no `.gitignore`).

### O que fazer quando o gate falha

1. Abrir o relatório HTML em `.lighthouseci/lhr-*.html` (ou o link na saída do CI).
2. Aba "Accessibility" lista os audits que pontuaram baixo (contraste, aria-labels, alt em img, foco visível, etc.).
3. Corrigir e re-rodar `bun run lhci`.
4. Se a regressão for inevitável (ex: nova dep com a11y ruim), abrir issue + ajustar threshold com explicação no commit message.

### Histórico

- **2026-05-17** — Gate instalado. Baseline CI (ubuntu-latest):
  - `/login`: perf 89 · a11y 100 · bp 95 · seo 100
  - `/signup`: perf 94 · a11y 100 · bp 95 · seo 100

---

## Documentação

- Atualizar [`README.md`](./README.md) e [`ARCHITECTURE.md`](./ARCHITECTURE.md) quando arquitetura mudar.
- Atualizar [`ENV-VARS.md`](./ENV-VARS.md) sempre que adicionar env nova.
- Docs de feature/migração específica como `STUBS-MIGRATED-*.md` ou `RADAR-CRON-DONE.md` são history — não delete, atualize com nota nova se a feature evoluir.

---

## Resumo das regras pra não quebrar

1. **Imports `.js`** dentro de `api/` (ESM strict).
2. **Auth check primeiro** em handlers — `authedPost` resolve por default.
3. **JWT vem do header** `Authorization: Bearer <token>`. Client injeta automaticamente em `apiInvoke` e `supabase.from()`.
4. **Polling, não WebSocket.** Não adicionar `supabase.channel(...)` — está deprecado no codebase.
5. **Buckets do Blob são prefixos de path.** `blobStorage.from('client-files')` virou `client-files/<path>`.
6. **Português brasileiro** em copy, comentários longos e docs. Código em inglês.
7. **Não commitar `.env.local`** (já no `.gitignore`).
8. **`super_admins` table controla acesso a UI de admin.** Hook `useSuperAdmin()` é o gate canônico.
9. **Cron auth:** `x-vercel-cron: 1` (Vercel) **ou** `Authorization: Bearer $CRON_SECRET` (manual).
10. **KAI = Lovable-managed em main.** Coordenar com Gabriel antes de merge.
