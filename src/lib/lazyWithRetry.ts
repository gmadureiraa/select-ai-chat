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
 * **Solução:** este wrapper:
 *   1. Detecta a mensagem específica do erro de chunk stale
 *   2. Força `window.location.reload()` (que pega o index.html fresco
 *      com as referências dos chunks NOVOS)
 *   3. Guarda flag em sessionStorage pra evitar loop infinito de reload
 *      caso o erro persista (servidor down, problema de CDN, etc)
 *
 * Uso: trocar `lazy(() => import('./Foo'))` por
 *      `lazyWithRetry(() => import('./Foo'))`.
 */

const RELOADED_KEY = 'kai_chunk_reloaded_at';
const RELOAD_COOLDOWN_MS = 60_000; // não reloada de novo em <1min

function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy<T>(async () => {
    try {
      return await importFn();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      // Evita loop: se já recarregou nos últimos 60s, propaga o erro
      // pro ErrorBoundary mostrar mensagem manual.
      const lastReload = Number(window.sessionStorage.getItem(RELOADED_KEY) ?? 0);
      const now = Date.now();
      if (now - lastReload < RELOAD_COOLDOWN_MS) {
        throw err;
      }

      window.sessionStorage.setItem(RELOADED_KEY, String(now));
      window.location.reload();
      // Retorna Promise pendente pra eternamente — UI mostra Suspense
      // fallback até o reload acontecer (não trava render).
      return new Promise(() => {});
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
