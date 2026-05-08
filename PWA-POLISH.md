# PWA Polish — KAI 2.0

Branch: `combo-viral-integration` (não commitado)

## Estado anterior

O projeto **já tinha** infra básica de PWA:

- `public/manifest.json` (sem `shortcuts` e com `start_url=/`)
- `public/sw.js` completo: install / activate / fetch (network-first nav, cache safe pra imagens/fonts/JSON, skip de JS/CSS pra evitar mismatch de chunks Vite), push, notificationclick, sync, message handler
- `public/icons/icon-192.png` + `icon-512.png`
- Registro do SW em `src/main.tsx` com fluxo seguro de update (skipWaiting + controllerchange + reload)
- `<link rel="manifest">` + apple-touch-icons + theme-color em `index.html`
- `useWebPushSubscription` (e `usePushNotifications`, `usePushSubscriptions`) usando `navigator.serviceWorker.ready` — todos compartilham o mesmo `/sw.js`

## Conflito com SW existente?

**Não.** O `sw.js` da raiz pública já é o único SW e já cobre push + cache. Nada foi tocado nele nem nos hooks de push. O registro em `main.tsx` continua sendo a única fonte de verdade.

## Mudanças desta passada

### 1. `public/manifest.json` — atualizado
- `start_url` agora `/kaleidos?source=pwa` (root da app real, redirect-free)
- Adicionado `lang: "pt-BR"`, `dir: "ltr"`
- Adicionados **3 shortcuts** com URLs validadas contra `src/pages/Kai.tsx`:
  - `Criar Carrossel` → `/kaleidos?tab=viral-carrossel`
  - `Radar Viral` → `/kaleidos?tab=viral-radar-page`
  - `Clientes` → `/kaleidos/clients`
- Mantidos ícones PNG existentes (192/512 any+maskable)

### 2. `src/components/pwa/InstallPrompt.tsx` — novo
- Listener de `beforeinstallprompt` (preventDefault + guarda evento)
- UI custom (Card + Button shadcn) bottom-right com Download icon
- Esconde se já está em standalone (`display-mode: standalone`)
- Persistência de "Depois" em `localStorage` por **7 dias** (`kai-pwa-install-dismissed-at`)
- Handler de `appinstalled` pra fechar imediatamente
- Tipagem `BeforeInstallPromptEvent` própria (TS strict OK)

### 3. `src/components/pwa/OfflineIndicator.tsx` — novo
- Toast discreto top-center que aparece quando `navigator.onLine === false`
- Listeners de `online`/`offline` no window
- Some sozinho ao reconectar
- Não compete com fallback do SW; é só feedback visual em sessão ativa

### 4. `src/pages/Offline.tsx` — novo
- Página estática rota `/offline` com ícone WifiOff + botão "Tentar novamente" (reload)
- Lazy-loaded em `App.tsx`
- Pode ser linkada explicitamente; o SW continua respondendo `caches.match(OFFLINE_URL)` em navegação offline

### 5. `src/App.tsx` — alterações mínimas
- Imports de `InstallPrompt` e `OfflineIndicator`
- Lazy import de `Offline`
- Nova rota `/offline`
- Render de `<InstallPrompt />` e `<OfflineIndicator />` dentro do `GlobalKAIProvider`, junto do `GlobalKAIAssistant`

## SW estratégia (resumo, sem mudanças)

| Path / tipo                                          | Estratégia                       |
|------------------------------------------------------|----------------------------------|
| Cross-origin                                         | bypass (network only)            |
| `/api/*`, `/supabase/*`                              | bypass                           |
| `/@*`, `/src/*`, `/node_modules/*`, `*.js/.mjs/.css/.map` | network only (evita chunks zumbis Vite) |
| Navegação (mode=`navigate`)                          | **network-first** + fallback `OFFLINE_URL=/` cacheado |
| Imagens, fonts, .json, .ico                          | **cache-first**, popula cache em hit de rede |
| Outros same-origin GETs                              | cache-match → fetch              |

Cache name: `kai-v2-20260128` — bumpar versão sempre que mudar shape de cache.

## Build

```
✓ built in 6.87s
```

TypeScript clean, sem warnings de tipos novos. Bundle não cresceu significativamente (InstallPrompt + OfflineIndicator + Offline page entram como código pequeno; Offline é lazy).

## Bloqueios / decisões

- **Não toquei em `public/sw.js`** — já estava melhor que o stub do briefing (push + sync + cache strategy refinada). Reescrever quebraria push em produção.
- **Não toquei em `useWebPushSubscription`** (nem `usePushNotifications`, `usePushSubscriptions`).
- **Não criei `src/lib/registerSW.ts`** — `main.tsx` já registra com fluxo de update production-ready. Adicionar wrapper só duplicaria código.
- **Não commitei** (instrução explícita).

## Próximos passos sugeridos (não feitos)

- Considerar `vite-plugin-pwa` se quiser auto-precache do build manifest (hoje SW só cacheia 5 assets fixos no install). Trade-off: dep nova vs. controle manual atual.
- Adicionar screenshots ao manifest (`screenshots: []`) — Chrome usa em rich install UI.
- Testar shortcuts em Chrome desktop + Android (long-press no ícone).
