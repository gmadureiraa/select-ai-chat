# Validation + Command Palette

Branch: `combo-viral-integration` (NOT committed)

Two features delivered:

1. **Zod input validation** in 5 critical API handlers — bad input now produces clear `Invalid input: <field>: <message>` errors before any business logic runs.
2. **Global Cmd+K Command Palette** — instant search/navigation/actions from anywhere in the app.

---

## Part 1 — Zod Validation

Pattern adopted in every handler:

```ts
import { z } from 'zod';

const BodySchema = z.object({ /* ... */ });

export default authedPost(async ({ body }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Invalid input: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }
  const { /* fields */ } = parsed.data;
  // ...
});
```

For raw `(req, res)` handlers (generate-content-v2, kai-content-agent) the validation runs after the JSON parse, returning `jsonError(res, 400, ...)` instead of throwing, matching the existing flow.

### Handlers validated

| File | Schema |
|---|---|
| `api/_handlers/scrape-website.ts` | `{ url: string().url(), clientId: string().min(1) }` |
| `api/_handlers/extract-instagram.ts` | `{ url: string().url().regex(instagramRegex), clientId?: string, uploadToStorage?: boolean }` |
| `api/_handlers/analyze-client-onboarding.ts` | `{ clientData: { name: string().min(1), description?, segment?, tone?, audience?, objectives?, socialMedia?: {...}, websites?: string[], documentContents?: string[] } }` |
| `api/_handlers/generate-content-v2.ts` | `{ type: 'text'|'image', inputs: AttachmentSchema[], config: {...}, clientId?: string|null, workspaceId?: string|null }` |
| `api/_handlers/kai-content-agent.ts` | `{ clientId: string().min(1), request?, message?, format?, platform?, workspaceId?, conversationHistory?: [{role,content}], includePerformanceContext?: boolean, additionalMaterial?: string, stream?: boolean }` |

### Wins

- **Bad URLs** → "Invalid input: url: URL must be a valid http(s) URL"
- **Bad Instagram URL** → "Invalid input: url: URL inválida. Use um link de post ou reel do Instagram."
- **Missing clientId** → "Invalid input: clientId: clientId é obrigatório"
- **Wrong type enum** → "Invalid input: type: Invalid enum value. Expected 'text' | 'image', received 'foo'"
- **Wrong array shape** → "Invalid input: inputs.0.type: Invalid enum value..."

Errors are clear, deterministic, and stop the request before hitting the LLM / Apify / Firecrawl, saving tokens and quota.

---

## Part 2 — Command Palette (Cmd+K)

`src/components/CommandPalette.tsx` — new global component.

- Internal `useState` + `useEffect` listener for `(metaKey || ctrlKey) + K`
- Opens a `Dialog` (Shadcn) wrapping the existing `Command` (cmdk-based) primitive
- `e.preventDefault()` so browser bookmarks/search bar shortcuts don't intercept
- Closing on selection routes via `useNavigate` from `react-router-dom`

### Items

**Navegação**
- Home Dashboard → `/kaleidos`
- Clientes → `/kaleidos/clients`
- Planning → `/kaleidos?tab=planning`
- Radar → `/kaleidos?tab=viral-radar-page`
- Biblioteca Viral → `/kaleidos?tab=viral-library`
- Performance → `/kaleidos?tab=performance`
- Configurações → `/kaleidos?tab=settings`

**Criar**
- Novo cliente → `/kaleidos/clients?action=new`
- Novo carrossel → `/kaleidos?tab=viral-carrossel`

### Wired in `App.tsx`

Added inside `<BrowserRouter>` (so `useNavigate` works), next to the global KAI Assistant:

```tsx
import { CommandPalette } from "@/components/CommandPalette";
// ...
<GlobalKAIAssistant />
<CommandPalette />
<InstallPrompt />
```

### Visual hint in sidebar

`src/components/kai/KaiSidebar.tsx` — added a `⌘K` hint right under the Workspace Switcher (only when sidebar is expanded):

```tsx
<div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/70 px-1">
  <span>Busca rápida</span>
  <kbd className="...">⌘K</kbd>
</div>
```

---

## Notes

- **Existing legacy `src/components/ui/command-palette.tsx`** was left untouched — it's a controlled component (open/onOpenChange props) that no current code imports. The new `CommandPalette` is the standalone global one.
- Zod was already a dependency (`^3.25.76`).
- `cmdk` powers the underlying `Command` primitive in `src/components/ui/command.tsx`.

## Build status

```
$ bun run build
✓ built in 6.99s
```

TypeScript clean on all 5 modified handlers (`tsc --noEmit` with project-aligned flags).
