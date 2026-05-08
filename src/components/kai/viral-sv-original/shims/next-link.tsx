/**
 * Shim de `next/link` → adaptado pro contexto KAI.
 *
 * Regras de re-roteamento (em ordem):
 *   1. `/app/plans` ou `/app/checkout?...` → search-param `?tab=billing` do
 *      shell do KAI (BillingTab eh fonte unica de cobranca, sem Stripe paywall
 *      duplicado dentro do SV).
 *   2. `/app/<path>` → hash route `#/<path>` do mini-router do MainApp
 *      (`pages-app/dashboard`, `pages-app/create-new`, etc).
 *   3. http(s)/mailto/tel/hash absoluto → anchor nativo.
 *
 * Side effects:
 *   - Cliques em "Upgrade" / "Assinar" dentro do SV viram navegacao pro
 *     BillingTab do KAI sem disparar Stripe direto.
 *   - Mantemos compat com `dashboard.tsx -> "/app/plans"` e variantes.
 */
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

interface NextLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
  as?: string;
}

/** Detecta rotas que devem virar tab=billing no shell do KAI. */
function isBillingRoute(href: string): boolean {
  if (!href) return false;
  // /app/plans, /app/plans?coupon=..., /app/checkout, /app/checkout?plan=...
  if (href === "/app/plans" || href.startsWith("/app/plans?")) return true;
  if (href === "/app/checkout" || href.startsWith("/app/checkout?")) return true;
  return false;
}

/** Tira o prefixo `/app` que o standalone usa em todas as rotas internas. */
function stripAppPrefix(href: string): string {
  if (href === "/app") return "/";
  if (href.startsWith("/app/")) return href.slice(4);
  return href;
}

function navigateToKaiBilling() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "billing");
  url.hash = "";
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const Link = forwardRef<HTMLAnchorElement, NextLinkProps>(function Link(
  {
    href,
    children,
    prefetch: _prefetch,
    replace,
    scroll: _scroll,
    shallow: _shallow,
    passHref: _passHref,
    legacyBehavior: _legacyBehavior,
    locale: _locale,
    as: _as,
    onClick,
    ...rest
  },
  ref,
) {
  const isExternal =
    typeof href === "string" &&
    (href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("#"));

  if (isExternal) {
    return (
      <a ref={ref} href={href} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }

  // Rota de billing → intercepta e leva pro BillingTab do KAI.
  if (isBillingRoute(href)) {
    const handle = (e: MouseEvent<HTMLAnchorElement>) => {
      // Permite ctrl/cmd-click pra abrir em nova aba (anchor sem onClick).
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      onClick?.(e);
      navigateToKaiBilling();
    };
    return (
      <a ref={ref} href="?tab=billing" onClick={handle} {...rest}>
        {children}
      </a>
    );
  }

  // Default: hash route do mini-router (#/dashboard, #/create/abc/edit ...)
  const hashTarget = `#${stripAppPrefix(href)}`;
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onClick?.(e);
    if (replace) {
      const newUrl = `${window.location.pathname}${window.location.search}${hashTarget}`;
      window.history.replaceState(null, "", newUrl);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = stripAppPrefix(href);
    }
  };

  return (
    <a ref={ref} href={hashTarget} onClick={handle} {...rest}>
      {children}
    </a>
  );
});

export default Link;
