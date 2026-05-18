import { lazy, type ComponentType } from 'react';

/**
 * `lazyWithRetry` — wrapper de `React.lazy` que recupera do erro
 * "Failed to fetch dynamically imported module" causado por chunks JS
 * com hash que ficaram stale após um deploy novo.
 *
 * **Problema:** SPA com code-splitting (Vite) gera chunks tipo
 * `PlanningItemDialog-BSvoOflg.js`. Quando o user tem a aba aberta com
 * o bundle antigo e o Vercel sobe um deploy novo, os chunks antigos
 * são apagados do servidor — o browser tenta baixar `PlanningItemDialog-
 * BSvoOflg.js` e ganha 404 → React.lazy joga "Failed to fetch dynamically
 * imported module".
 *
 * **Solução em 3 camadas:**
 *   1. Detecta a mensagem específica do erro de chunk stale
 *   2. **Limpa Service Worker caches** (SW cacheia o offline shell de '/'
 *      e algumas vezes serve index.html antigo) — força fetch fresh do
 *      servidor. Sem isso, mesmo após reload o browser pega o index velho
 *      do SW cache → mesmo erro de novo → loop.
 *   3. Hard reload com cache-bust query (`?v=<ts>`) pra contornar
 *      qualquer cache HTTP que ignore o header no-cache.
 *   4. Cooldown de 8s em sessionStorage pra evitar loop infinito de
 *      reload (servidor down, CDN inconsistente).
 *
 * Uso: trocar `lazy(() => import('./Foo'))` por
 *      `lazyWithRetry(() => import('./Foo'))`.
 */

const RELOADED_KEY = 'kai_chunk_reloaded_at';
const RELOAD_COOLDOWN_MS = 8_000; // permite 1 reload + 1 retry rápido se SW

function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Expected a JavaScript-or-Wasm module script') ||
    msg.includes('MIME type "text/html"') ||
    msg.includes("MIME type 'text/html'") ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
}

/**
 * Limpa Service Worker caches e desregistra workers antes do reload.
 * Sem isso, SW pode estar servindo index.html antigo de cache mesmo
 * após o `Cache-Control: no-store` no servidor.
 */
async function clearServiceWorkerCachesAndReload(): Promise<never> {
  if (typeof window === 'undefined') {
    throw new Error('lazyWithRetry: window unavailable');
  }

  // 1. Limpa todas as caches do SW (offline shell, assets cacheados etc).
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Ignore — pode falhar em contexto sem permissão.
  }

  // 2. Unregister TODOS os service workers (vão ser reregistrados na próxima carga).
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // Ignore.
  }

  // 3. Reload com cache-bust query — força bypass HTTP cache + SW.
  // `window.location.reload()` herda HTTP cache do browser; URL nova com
  // ?v= força nova request mesmo se cache antigo persiste.
  const url = new URL(window.location.href);
  url.searchParams.set('_cb', String(Date.now()));
  window.location.replace(url.toString());

  // Promise que nunca resolve — UI fica em Suspense até navegação completar.
  return new Promise(() => {}) as never;
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy<T>(async () => {
    try {
      return await importFn();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      // Evita loop: se já recarregou nos últimos N segundos, propaga
      // o erro pro ErrorBoundary mostrar mensagem manual com botão
      // que faz a mesma limpeza ao clicar.
      const lastReload = Number(window.sessionStorage.getItem(RELOADED_KEY) ?? 0);
      const now = Date.now();
      if (now - lastReload < RELOAD_COOLDOWN_MS) {
        throw err;
      }

      window.sessionStorage.setItem(RELOADED_KEY, String(now));
      return clearServiceWorkerCachesAndReload();
    }
  });
}

/**
 * Helper pra checar se um erro capturado por ErrorBoundary é o erro
 * de chunk stale — usado pra renderizar fallback específico ("Versão
 * nova disponível. Recarregar?") em vez do erro genérico.
 */
export function isStaleChunkError(err: unknown): boolean {
  return isChunkLoadError(err);
}

/**
 * Hard reload que ErrorBoundary deve chamar quando user clica "Recarregar".
 * Igual ao auto-reload do lazyWithRetry: limpa SW caches + unregister +
 * reload com cache-bust. Sem isso, botão pode levar pro mesmo loop.
 */
export async function hardReloadClearingCaches(): Promise<void> {
  // Reset cooldown pra próxima carga já permitir auto-retry se ainda houver erro.
  try {
    window.sessionStorage.removeItem(RELOADED_KEY);
  } catch {
    // Ignore.
  }
  await clearServiceWorkerCachesAndReload();
}
