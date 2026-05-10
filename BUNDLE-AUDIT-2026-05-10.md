# Bundle Audit KAI 2.0 — 2026-05-10

> Audit estático + build production. Stack: Vite 5.4 + React 18 + Tailwind 3 + Bun.
> Build executado: `bun run build` (vite build, 5063 modules, ~6.4s).

## Resumo executivo

- **Initial bundle (rotas públicas)**: ~441 kB gzip. Core puxa entry (113kB) + react-vendor (59kB) + ui-vendor (52kB) + data-vendor (55kB) + auth-vendor (84kB) + icons-vendor (15kB) + motion-vendor (38kB, eager via FloatingKAIButton) + CSS (25kB).
- **Maior chunk single-file**: `export-pdf-vendor` 415kB raw / 136kB gzip (jspdf). Já é dynamic import → não pesa no initial.
- **Vendor inflado sem custo justificado**: `auth-vendor` 323kB / 84kB gzip (`@neondatabase/auth` + `@neondatabase/serverless`). Inclui adapters react/next/supabase mesmo só usando `vanilla/adapters`.
- **Chunks vazios sinalizando dead code**: `xlsx` (1 byte), `flow-vendor` (70 bytes — reactflow nodes nunca importadas), `form-vendor` (36 bytes — react-hook-form só em `ui/form.tsx` órfão).
- **Deps órfãs claras (8)**: xlsx, react-window, @types/react-window, @hookform/resolvers, @neondatabase/auth-ui, @lovable.dev/cloud-auth-js, tailwindcss-animate (verificar plugin), @playwright/test (devDep mal classificado).
- **UI primitives shadcn dead** (14 arquivos em `src/components/ui/` 0 importadores): aspect-ratio, breadcrumb, carousel, chart, context-menu, drawer, form, input-otp, menubar, navigation-menu, pagination, resizable, sidebar, skeleton-list. Cada um arrasta @radix-ui/embla/vaul/cmdk/etc transitivamente.
- **Hooks/configs/types dead**: 7 hooks + 2 configs + 1 type + 1 shim em `src/`.
- **Arquivos vestígio no root**: `package-lock.json` (npm vestígio, bun usa bun.lock), `bun.lockb` (formato binário antigo, bun moderno usa `bun.lock` texto), 2 `.tsbuildinfo`, `_inspect_clients.mjs`/`_seed_clients.mjs` adhoc, `.env.local.tmp`, `.env.vercel-temp`.
- **Não há lib genuinamente duplicada** que faça mesma coisa. Toaster duplo (sonner + radix toast) é design intencional do shadcn (ambos renderizados em App.tsx). Markdown único via react-markdown.

---

## Top 20 chunks (gzip)

| # | Chunk | Raw | Gzip | Conteúdo provável | Oportunidade |
|---|-------|-----|------|--------------------|---------------|
| 1 | export-pdf-vendor | 415kB | 136kB | jspdf core | Já lazy. OK. |
| 2 | index (entry) | 366kB | 113kB | App.tsx + providers + WorkspaceRouter eager + GlobalKAIAssistant + lib utils + `@vercel/analytics` | Mover GlobalKAIAssistant pra lazy reduz ~30kB |
| 3 | chart-vendor | 405kB | 109kB | recharts | 5 call sites — considerar render condicional (já é shared) |
| 4 | auth-vendor | 323kB | 84kB | @neondatabase/auth (vanilla) + @neondatabase/serverless | Eager. **Item nº1 a investigar** — a lib inclui adapters react/next que talvez tree-shake mal |
| 5 | react-vendor | 179kB | 59kB | react + react-dom + react-router-dom | Inevitável. OK. |
| 6 | data-vendor | 212kB | 55kB | @tanstack/react-query + @supabase/supabase-js | OK |
| 7 | ui-vendor | 182kB | 52kB | 14 @radix-ui primitives | Pode shrinkar removendo radix das UI órfãs |
| 8 | index.es (transitiva) | 151kB | 51kB | dompurify (transitive de jspdf) | Já lazy junto com jspdf. OK. |
| 9 | html2canvas.esm | 201kB | 48kB | html2canvas (transitive jspdf) | Já lazy. OK. |
| 10 | SettingsTab | 187kB | 50kB | SettingsTab + 7 sub-components (Team/Notification/AI/Webhook/Integrations/AuditLog/Nav) eager | Lazy load nas tabs internas |
| 11 | ClientsListPage | 159kB | 40kB | + ClientOnboardingWizard 918 linhas | Wizard pode ser lazy quando dialog abre |
| 12 | motion-vendor | 114kB | 38kB | framer-motion | **Eager** via FloatingKAIButton. Mover button pra usar CSS-only animation reduz initial em 38kB |
| 13 | PlanningBoard | 127kB | 35kB | board + filters + cards + kanban + calendar | OK lazy. Calendar pode ser sub-lazy. |
| 14 | export-zip-vendor | 97kB | 30kB | jszip | Já lazy. OK. |
| 15 | MetricoolPerformance | 76kB | 20kB | recharts + perf views | OK |
| 16 | use-draft | 75kB | 15kB | hook viral-sv | OK lazy |
| 17 | Kai | 71kB | 19kB | página principal | OK lazy |
| 18 | KaiLibraryTab | 68kB | 18kB | library tab | OK |
| 19 | dnd-vendor | 50kB | 17kB | @dnd-kit core+sortable+utilities | Só usado em planning. Já lazy via PlanningBoard. OK. |
| 20 | onboarding | 46kB | 13kB | onboarding flow | Eager via Kai page (que é lazy). OK. |

---

## Deps órfãs (no package.json sem importadores)

| Dep | Versão | Tamanho aprox | Status | Decisão |
|-----|--------|---------------|--------|---------|
| `xlsx` | 0.18.5 | ~430kB raw | 0 imports em src/api | **REMOVER** |
| `react-window` | 2.2.3 | ~30kB | 0 imports — só refs em docs | **REMOVER** |
| `@types/react-window` | 1.8.8 | dev type | dep dele | **REMOVER junto** |
| `@hookform/resolvers` | 3.10.0 | ~10kB | 0 imports — `react-hook-form` só em `ui/form.tsx` órfão | **REMOVER (junto com form.tsx + react-hook-form)** |
| `@neondatabase/auth-ui` | 0.2.0-beta | 60MB node_modules | 0 imports | **REMOVER** (auth-ui não foi adotado) |
| `@lovable.dev/cloud-auth-js` | 1.0.0 | n/a | 0 imports — só ref em ARCHITECTURE.md | **REMOVER** (legacy Lovable) |
| `@playwright/test` | 1.57.0 | dev tool | usado só em e2e/ + playwright.config | **MOVER pra devDependencies** (atualmente em deps prod) |
| `tailwindcss-animate` | 1.0.7 | dev plugin | usado em tailwind.config.ts | Mover pra devDependencies (já é plugin de build) |

---

## Libs pesadas usadas marginalmente

| Lib | Tamanho gzip | Call sites | Comentário |
|-----|--------------|------------|------------|
| `recharts` | 109kB | 5 arquivos | Usado só em ClientAnalyticsTab + 3 componentes performance-v2 + wrapper `ui/chart.tsx` órfão. Já lazy via lazy pages. **OK**. |
| `framer-motion` | 38kB | 35 arquivos, **eager via FloatingKAIButton** | Componente FloatingKAIButton eager carrega motion-vendor no initial. Animação simples (open/close + scale). Substituir por CSS animations reduz 38kB do initial. |
| `reactflow` | (chunk vazio 70 bytes) | 4 arquivos `automations/visual-builder/nodes/*` — **ninguém importa as nodes** | Dead code. Remover dep + os 4 arquivos. |
| `jspdf` | 136kB | 5 arquivos com `await import("jspdf")` | Já totalmente lazy. **OK**. |
| `jszip` | 30kB | 5 arquivos com `await import("jszip")` | Já totalmente lazy. **OK**. |
| `html-to-image` | (em export-html-vendor 5kB gzip) | dynamic only | OK |
| `lucide-react` | 15kB | 230 arquivos, 235 imports | Eager (icons-vendor). Tree-shaking funciona. **OK**. |
| `@dnd-kit` | 17kB | 2 arquivos (PlanningBoard + Kanban) | Já lazy via PlanningBoard. OK. |
| `react-day-picker` | (embute em form-vendor zero) | só `ui/calendar.tsx` órfão | Remove com calendar.tsx + dep |
| `embla-carousel-react` | n/a | só `ui/carousel.tsx` órfão | Remove |
| `vaul` | n/a | só `ui/drawer.tsx` órfão | Remove |
| `react-hook-form` | n/a | só `ui/form.tsx` órfão | Remove |
| `react-resizable-panels` | n/a | só `ui/resizable.tsx` órfão | Remove |
| `input-otp` | n/a | só `ui/input-otp.tsx` órfão | Remove |
| `@radix-ui/react-aspect-ratio` | n/a | só `ui/aspect-ratio.tsx` órfão | Remove |
| `@radix-ui/react-context-menu` | n/a | só `ui/context-menu.tsx` órfão | Remove |
| `@radix-ui/react-menubar` | n/a | só `ui/menubar.tsx` órfão | Remove |
| `@radix-ui/react-navigation-menu` | n/a | só `ui/navigation-menu.tsx` órfão | Remove |
| `@radix-ui/react-hover-card` | n/a | 2 importadores (1 fora ui/) | Verificar — provavelmente legítimo |

---

## Oportunidades de lazy/dynamic import

1. **FloatingKAIButton** (eager via App.tsx) — substituir `framer-motion` por CSS keyframes. Economia: -38kB gzip do initial.
2. **GlobalKAIAssistant container** — atualmente eager pra renderizar FloatingKAIButton. Subcomponentes (Panel/Chat/Input) já são lazy. OK.
3. **SettingsTab** — 187kB raw / 50kB gzip. Cada `Settings*` sub-component (Team, AIUsage, Webhook, Integrations, AuditLog, Notification) hoje é estático. Converter pra lazy por seção (`SettingsNavigation` switch) → reduz primeiro paint da rota /settings.
4. **ClientOnboardingWizard** — 918 linhas, embutido em ClientsListPage chunk (40kB gzip). Lazy quando dialog abre.
5. **`auth-vendor`** — investigar tree-shake do `@neondatabase/auth`. O export `vanilla/adapters` deveria carregar só o `SupabaseAuthAdapter`, mas o chunk tem 84kB gzip. Talvez side-effects no index não permitam tree-shake. Considerar import direto `@neondatabase/auth/vanilla/adapters` apenas.
6. **`reactflow`** — chunk já vazio (70 bytes) porque nodes não são importadas. Remover a dep (10MB de node_modules).

---

## Bibliotecas duplicadas (mesma função)

Após análise, **não há duplicação genuína de funcionalidade**:

- `sonner` + `@radix-ui/react-toast` → ambos renderizados em App.tsx, mas é design intencional do shadcn (toast contextual + global). 70 call sites usam sonner; 9 usam `use-toast` (radix). **Sugestão**: padronizar em sonner e remover toast.tsx + toaster.tsx + use-toast.ts + dep `@radix-ui/react-toast`.
- `RichContentEditor` existe em 2 lugares (`planning/` 14kB e `kai/library/` 7.5kB). São files DIFERENTES (não dup) — planning tem edição completa, library tem versão simplificada. OK.
- Markdown: só `react-markdown`. OK.
- Charts: só `recharts`. OK.
- Date: só `date-fns`. OK.
- Drag: só `@dnd-kit`. OK.

---

## Arquivos morto no repo (não-código)

| Arquivo | Status | Motivo |
|---------|--------|--------|
| `package-lock.json` (322kB) | **REMOVER** | Vestígio npm. `.npmrc` e scripts usam bun. `bun.lock` é o source of truth |
| `bun.lockb` (197kB) | **REMOVER** | Formato binário antigo do Bun. Bun moderno usa `bun.lock` (text) que já existe |
| `tsconfig.app.tsbuildinfo` | **REMOVER** | Cache TypeScript. Já está em `.gitignore` (`*.tsbuildinfo`) — provavelmente só local |
| `tsconfig.node.tsbuildinfo` | **REMOVER** | idem |
| `_inspect_clients.mjs` | **REMOVER ou mover** | Script adhoc do user. Considerar `scripts/` |
| `_seed_clients.mjs` (38kB) | **REMOVER ou mover** | Script adhoc. Considerar `scripts/` |
| `.env.local.tmp` | **REMOVER** | Backup de env, gitignored |
| `.env.vercel-temp` | **REMOVER** | idem |
| `_legacy/` (148kB) | **OPCIONAL** | Apenas mencionado em comentários (`Kai.tsx`, shim `next-link.tsx`). Pode arquivar |

## Arquivos de código mortos (estáticos, 0 importadores)

### TS/TSX dead files

```
src/components/kai/performance-v2/components/FollowersSparkline.tsx
src/components/automations/visual-builder/nodes/PublishNode.tsx
src/components/automations/visual-builder/nodes/ConditionNode.tsx
src/components/automations/visual-builder/nodes/WebhookNode.tsx
src/components/automations/visual-builder/nodes/APINode.tsx
src/types/metaAds.ts
src/config/contextualTasks.ts
src/config/ai-models.ts
src/integrations/neon-auth/auth-shim.ts
src/integrations/neon/db-client.ts
src/hooks/useContentCreator.ts
src/hooks/useExtractBranding.ts
src/hooks/useConversationHistory.ts
src/hooks/useWorkspaceContentAggregate.ts
src/hooks/useInstagramImport.ts
src/hooks/useBrandAssets.ts
src/hooks/useClientTemplates.ts
```

### UI primitives órfãos (shadcn unused)

```
src/components/ui/aspect-ratio.tsx
src/components/ui/breadcrumb.tsx
src/components/ui/carousel.tsx       (puxa embla-carousel-react)
src/components/ui/chart.tsx          (puxa recharts wrapper)
src/components/ui/context-menu.tsx   (puxa @radix-ui/react-context-menu)
src/components/ui/drawer.tsx         (puxa vaul)
src/components/ui/form.tsx           (puxa react-hook-form)
src/components/ui/input-otp.tsx      (puxa input-otp)
src/components/ui/menubar.tsx        (puxa @radix-ui/react-menubar)
src/components/ui/navigation-menu.tsx (puxa @radix-ui/react-navigation-menu)
src/components/ui/pagination.tsx
src/components/ui/resizable.tsx      (puxa react-resizable-panels)
src/components/ui/sidebar.tsx
src/components/ui/skeleton-list.tsx
src/components/ui/calendar.tsx       (puxa react-day-picker — usado dentro? confirmar)
```

> Nota: removidos a granel se confirmado. Lembrar que tree-shaking remove o JS mas as deps no package.json continuam pesando node_modules e CI/CD.

---

## Plano P0 / P1 / P2

### P0 — Remover imediatamente (alta confiança)

1. **Lockfiles redundantes**: deletar `package-lock.json` + `bun.lockb`. Manter só `bun.lock`.
2. **Build artifacts**: deletar `*.tsbuildinfo` no root.
3. **Env temp files**: deletar `.env.local.tmp`, `.env.vercel-temp` (já gitignored).
4. **Deps órfãs claras** (`bun remove`):
   - `xlsx`
   - `react-window` + `@types/react-window`
   - `@hookform/resolvers`
   - `@neondatabase/auth-ui`
   - `@lovable.dev/cloud-auth-js`
5. **Mover devDeps**: `@playwright/test` de `dependencies` → `devDependencies` (só usado em e2e). `tailwindcss-animate` idem (já é plugin tailwind config).
6. **Reactflow + nodes**: deletar `src/components/automations/visual-builder/nodes/*.tsx` + `bun remove reactflow`. Chunk `flow-vendor` desaparece.
7. **manualChunks**: tirar `flow-vendor` e `form-vendor` (vão pra zero) e `export-xlsx-vendor` do `vite.config.ts`.

### P1 — Revisar antes de executar

1. **UI primitives shadcn órfãos** (15 arquivos): se Gabriel confirmar que nenhuma feature futura próxima vai usar, deletar arquivos + deps Radix/embla/vaul/etc. Estimativa: -200kB no node_modules, -10kB ui-vendor gzip.
2. **`react-hook-form` + `ui/form.tsx`**: removível só após confirmar. Não tem nenhum form usando.
3. **Dead hooks/configs/types** (10 arquivos): seguro deletar mas confirmar com `git log` que não foram criados pra feature recente parada.
4. **Toaster duplo**: padronizar em sonner. Deletar `ui/toast.tsx`, `ui/toaster.tsx`, `hooks/use-toast.ts`, `@radix-ui/react-toast`. Atualizar 9 call sites.
5. **FloatingKAIButton sem framer-motion**: substituir motion/AnimatePresence por CSS keyframes. Economia ~38kB gzip do initial bundle.
6. **`auth-vendor` tree-shake**: investigar import direto de `@neondatabase/auth/vanilla/adapters` em vez de `@neondatabase/auth`. Pode reduzir auth-vendor 30-50%.

### P2 — Nice-to-have

1. SettingsTab: lazy split por sub-tab.
2. ClientOnboardingWizard: lazy load no dialog open.
3. `_inspect_clients.mjs` + `_seed_clients.mjs`: mover pra `scripts/` e adicionar a `.gitignore` se forem locais.
4. `_legacy/`: deletar ou mover pra `vault/99 - SISTEMA/biblioteca/kai-legacy/`.
5. Doc cleanup: 58 `.md` na raiz. Considerar mover audits antigos pra `docs/audits/`.

---

## Estimativa de redução

### node_modules
- Atual: 911 MB
- Pós-P0: ~830 MB (-9% — remoção de @neondatabase/auth-ui 60MB, xlsx, react-window, hookform, lovable-cloud)
- Pós-P0+P1: ~700 MB (-23% — remoção dos 15 UI órfãos + radix/embla/vaul/etc)

### Bundle inicial gzip (cold load primeira rota lazy)
- Atual: ~441 kB gzip
- Pós-P0: ~441 kB gzip (sem mudança no client — deps órfãs não estavam no bundle de qualquer forma; ganho é em CI/CD speed e clarity)
- Pós-P1 com FloatingKAIButton CSS-only: ~403 kB gzip (-9%)
- Pós-P1 com auth-vendor tree-shake otimizado (estimativa -30kB gzip): ~373 kB gzip (-15%)

### Build time
- Atual: 6.4s
- Pós-P0: ~5.5s (menos transformações — remoção de deps órfãs, chunks zero)
- Pós-P1: ~5.0s

---

## Comandos sugeridos (P0 — autorizados em outro turno)

```bash
# Lockfiles e build artifacts
rm package-lock.json bun.lockb tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo
rm .env.local.tmp .env.vercel-temp

# Deps órfãs
bun remove xlsx react-window @types/react-window @hookform/resolvers \
           @neondatabase/auth-ui @lovable.dev/cloud-auth-js reactflow

# Reorganizar devDeps
bun remove @playwright/test tailwindcss-animate
bun add -d @playwright/test tailwindcss-animate

# Reactflow nodes dead
rm src/components/automations/visual-builder/nodes/*.tsx
rmdir src/components/automations/visual-builder/nodes
rmdir src/components/automations/visual-builder

# Atualizar vite.config.ts: tirar flow-vendor / form-vendor / export-xlsx-vendor de manualChunks

# Validar
bun run build
```

---

*Gerado por audit estático. Build production verificado: 6.43s, 5063 modules. Análise via grep/find sobre `src/` e `api/` (excluindo node_modules, dist, viral-sv-original/radar/reels exceto onde alias `@sv` é referenciado).*
