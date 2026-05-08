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
 * Se href é externo (http(s)://) renderiza <a> direto.
 * Se href começa com /app/* (rotas internas do Radar), por enquanto
 * tratamos como app links — react-router redireciona se a rota existir,
 * caso contrário cai num <a> normal e o KAI deals com 404.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch: _p, replace, scroll: _s, shallow: _sh, ...rest },
  ref,
) {
  if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <RRLink ref={ref} to={href} replace={replace} {...(rest as object)}>
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
