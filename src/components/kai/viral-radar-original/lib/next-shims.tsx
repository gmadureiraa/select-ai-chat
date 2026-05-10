/**
 * Shims pra emular a API de `next/link` e `next/navigation` em cima de
 * `react-router-dom` v6. Permite copiar componentes do standalone
 * (Next.js) com **mínima edição** — só os imports mudam.
 *
 * - `Link` → react-router-dom `Link`, mas aceita `href` em vez de `to`
 * - `usePathname()` → router.location.pathname
 * - `useRouter()` → wrapper com `replace`/`push`/`back` (subset usado)
 * - `useSearchParams()` → simula a API do Next (GET-only)
 *
 * O Radar Viral usa rotas internas tipo "/app", "/app/news?q=..." que aqui
 * dentro do KAI são views internas do MainApp — então o shim aceita esses
 * paths e o MainApp intercepta via `onNavigate` quando faz sentido.
 */

import { forwardRef } from "react";
import {
  Link as RRLink,
  useLocation,
  useNavigate,
  useSearchParams as useRRSearchParams,
} from "react-router-dom";

interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

/**
 * Link compatível com next/link mas usando react-router-dom.
 *
 * Regras (em ordem):
 *   - http(s)://, mailto: → anchor nativo
 *   - /app/* → standalone Radar tinha sub-routes (/app/news, /app/precos,
 *     /app/saved). Dentro do KAI essas views não existem (radar usa state
 *     local), então /app/* vira no-op pra não cair no fallback `/:slug`
 *     do shell (que redireciona pra /kaleidos e tira o user da tab).
 *   - default → react-router-dom Link (rota interna)
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch: _p, replace, scroll: _s, shallow: _sh, onClick, ...rest },
  ref,
) {
  if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
    return (
      <a ref={ref} href={href} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }
  // /app/* — standalone Radar route. No KAI essas views vivem em state local;
  // não navegamos pra fora pra preservar contexto. Click vira no-op (mantém
  // estilo de link, mas não faz nada).
  if (href.startsWith("/app")) {
    const handle = (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Permite cmd/ctrl-click pra abrir em nova aba (fallback amigável).
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      onClick?.(e);
    };
    return (
      <a ref={ref} href={href} onClick={handle} role="button" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <RRLink ref={ref} to={href} replace={replace} onClick={onClick} {...(rest as object)}>
      {children}
    </RRLink>
  );
});

export function usePathname(): string {
  const loc = useLocation();
  return loc.pathname;
}

export function useRouter() {
  const nav = useNavigate();
  return {
    push: (url: string) => nav(url),
    replace: (url: string) => nav(url, { replace: true }),
    back: () => nav(-1),
    forward: () => nav(1),
    refresh: () => {
      /* noop — Vite não tem refresh nativo */
    },
    prefetch: () => {
      /* noop */
    },
  };
}

/**
 * useSearchParams compatível com next/navigation.
 * Retorna um wrapper com `.get(key)` que devolve string|null.
 */
export function useSearchParams() {
  const [sp] = useRRSearchParams();
  return {
    get: (key: string) => sp.get(key),
    getAll: (key: string) => sp.getAll(key),
    has: (key: string) => sp.has(key),
    keys: () => sp.keys(),
    values: () => sp.values(),
    entries: () => sp.entries(),
    forEach: (cb: (value: string, key: string) => void) => sp.forEach(cb),
    toString: () => sp.toString(),
    [Symbol.iterator]: () => sp[Symbol.iterator](),
  };
}
