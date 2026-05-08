# E2E Tests — KAI App Combo

Suite Playwright cobrindo smoke tests críticos contra prod (`https://kai-2-topaz.vercel.app`) ou local (`http://localhost:8080`).

## Quick start

```bash
# Instalar browsers (1ª vez)
bunx playwright install chromium

# Rodar contra prod
bun run test:e2e:prod

# Rodar contra local (precisa de bun run dev em outro terminal)
bun run test:e2e

# UI mode interativo
bun run test:e2e:ui

# Ver último relatório HTML
bun run test:e2e:report
```

Configuração principal:
- `playwright.config.ts` — usa `PLAYWRIGHT_BASE_URL` (default `http://localhost:8080`).
- `playwright-fixture.ts` — re-exporta `test`/`expect` do `@playwright/test` (extender custom fixtures aqui).
- `e2e/` — specs (`.spec.ts`).

## Estado atual (baseline)

**28 / 28 tests passando contra prod (https://kai-2-topaz.vercel.app), 100% pass rate.**

Tempo total: ~10s. Workers: 5.

## Arquivos & cobertura

### `e2e/01-public-pages.spec.ts` — 6 testes

| Teste | O que valida |
|---|---|
| home (/) responde 200 e SPA mounta | Status < 400, `<title>` contém "KAI", `#root` no DOM |
| /login carrega com formulário | Inputs `type=email` e `type=password` visíveis |
| /signup carrega | Status OK + `#root` montado |
| /404 mostra NotFound | Body contém "404" / "not found" / "não encontrad" |
| Rota inexistente cai no NotFound (catch-all) | Aceita NotFound OU redirect → /kaleidos (regra `:slug`) |
| GET /api/mcp-reader retorna JSON | 200 com `tools: [...]` OU 401 (sem `MCP_ACCESS_TOKEN`) |

### `e2e/02-auth-flow.spec.ts` — 4 testes

| Teste | O que valida |
|---|---|
| /login tem email + password + submit | Seletor `button[type=submit]` (não confundir com Google OAuth button) |
| Submit form vazio mantém em /login | HTML5 `required` bloqueia, sem redirect |
| Credenciais inválidas geram erro | URL não vai pra /kaleidos depois de submit com creds fakes |
| /signup tem campos básicos | Input email visível |

### `e2e/03-api-handlers.spec.ts` — 8 testes

| Teste | Resultado esperado |
|---|---|
| GET /api/mcp-reader | 200 ou 401 + JSON válido |
| POST /api/scrape-website sem auth | 401 + `error` |
| POST /api/extract-instagram sem auth | 401 + `error` |
| POST /api/blob/upload-token sem auth | 401 + `error` |
| POST /api/stripe-webhook sem body | 400/401/403/503 (nunca 200) |
| POST /api/nonexistent-handler | 404 |
| GET /api/nonexistent-handler | 404 |
| /api/get-vapid-public-key existe | Status ≠ 404 |

### `e2e/04-routing.spec.ts` — 5 testes

| Teste | O que valida |
|---|---|
| / redireciona para /kaleidos | URL bate `/kaleidos` ou `/login` (poll até 10s) |
| /:slug arbitrário redireciona | URL final em `/kaleidos`, `/login`, ou `/404` |
| /export-madureira carrega | Status OK + `#root` |
| Bundle splits funcionam | Vários chunks JS distintos servidos |
| /login NÃO redireciona pra /kaleidos | Sem auth fica em `/login` |

### `e2e/05-perf.spec.ts` — 5 testes

| Teste | Threshold | Baseline atual |
|---|---|---|
| TTFB / < 3s | < 3000ms | ~20ms (warm) |
| HTML inicial leve | < 50KB | ~3KB |
| Bundle JS total razoável | < 8MB descomprimido + > 3 chunks | 4.78MB / 16 chunks |
| DOMContentLoaded | < 5s | ~400ms |
| Sem console errors críticos | TypeError/ReferenceError/SyntaxError = 0 | OK |

## Achados da baseline

1. **Bundle pesado:** 4.78MB descomprimido. Top 3 chunks:
   - `export-vendor-*.js` — 960KB (jspdf + jszip + html-to-image + xlsx — split correto)
   - `auth-vendor-*.js` — 340KB
   - `index-*.js` — 333KB
   
   Considerar lazy-load do `export-vendor` (só usado em /export-madureira e modais de export).

2. **Login dual:** form de email/senha + botão "Entrar com Google" (Neon Auth OAuth). Seletor de submit precisa ser `button[type=submit]` específico — `:has-text("Entrar")` pega o de Google primeiro.

3. **mcp-reader requer auth:** retorna 401 sem `MCP_ACCESS_TOKEN`. Em prod com env setado, retorna catalog 200.

4. **API router catch-all:** `/api/<qualquer-coisa-inválida>` retorna 404 JSON (não falha de rota Vercel).

## Gaps & próximos passos

Coisas NÃO cobertas (precisam de credenciais reais ou mock infra):

- [ ] Login real (signup → confirm email → first session). Bloqueado: sem credentials de teste.
- [ ] Fluxo /kaleidos completo (workspace, clientes, content). Precisa session válida.
- [ ] Geração de conteúdo (Gemini, Imagen). Precisa session + API quotas.
- [ ] Stripe checkout flow. Precisa Stripe test mode + session.
- [ ] Realtime/Supabase channels. Precisa session + setup.
- [ ] Mobile viewport (todos os testes rodam em Desktop Chrome).
- [ ] Dark mode toggle.
- [ ] Upload via blob/upload-token (com auth).

Sugestões de extensões:

1. **Auth fixture** — adicionar fixture custom que cria session via API (bypass UI) usando `NEON_AUTH_*` test tokens.
2. **Cross-browser** — habilitar `firefox` e `webkit` projects no `playwright.config.ts`.
3. **CI integration** — rodar suite no GitHub Actions / Vercel CI no PR (set `CI=1`).
4. **Visual regression** — `await expect(page).toHaveScreenshot()` em pages-chave.
5. **Lighthouse CI** — adicionar `@playwright/test` + `playwright-lighthouse` pra Core Web Vitals.

## Cobertura estimada

- Public/unauthenticated UI: **~70%** (todas as rotas sem login estão tocadas)
- API handlers (auth gates): **~10%** (5 dos 101 handlers smoke-testados)
- Authenticated flows: **0%** (bloqueado por falta de credentials)
- Performance baseline: **estabelecida** (4 métricas-chave)

Total estimado da app: **~25%** — bom pra detectar regressões grosseiras (build quebrado, rotas 500, auth bypass acidental, bundle explodindo).
