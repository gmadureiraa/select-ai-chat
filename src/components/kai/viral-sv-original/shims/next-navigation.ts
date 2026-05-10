/**
 * Shim de `next/navigation` → adaptado pro mini hash-router do MainApp
 * (`#/dashboard`, `#/create/abc/edit`).
 *
 * Como o `viral-sv-original` vive DENTRO do shell do KAI (que tem seu
 * próprio react-router top-level), navegar pelo react-router daqui
 * conflita com a sidebar do KAI. Por isso usamos hash:
 *   - Push muda `window.location.hash`
 *   - O MainApp escuta `hashchange` e re-render-rendea a página
 *
 * Side effect: links como `/app/carousels` (path absoluto Next) viram
 * `#/carousels` em runtime via normalização aqui (`stripAppPrefix`).
 */
import { useEffect, useState } from "react";

/** Tira o prefixo `/app` que o standalone usa em todas as rotas internas. */
function stripAppPrefix(href: string): string {
  if (href === "/app") return "/";
  if (href.startsWith("/app/")) return href.slice(4);
  return href;
}

/**
 * Detecta rotas de billing/checkout do SV e redireciona pro BillingTab do KAI
 * (search param `?tab=billing` do shell). Centraliza qualquer programmatic
 * navigation pra Stripe paywall que sobrou nas pages copiadas.
 */
function isBillingHref(href: string): boolean {
  if (!href) return false;
  if (href === "/app/plans" || href.startsWith("/app/plans?")) return true;
  if (href === "/app/checkout" || href.startsWith("/app/checkout?")) return true;
  return false;
}

function navigateToKaiBilling(): void {
  if (typeof window === "undefined") return;
  // KAI 2.0 não tem BillingTab (removido 2026-05-09). Redireciona para
  // Settings → workspace section.
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "settings");
  url.searchParams.set("section", "workspace");
  url.hash = "";
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export interface AppRouter {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => void;
}

export function useRouter(): AppRouter {
  return {
    push: (href: string) => {
      if (href.startsWith("http") || href.startsWith("mailto:")) {
        window.location.href = href;
        return;
      }
      // Plans/checkout legacy → BillingTab do KAI (sem Stripe direto).
      if (isBillingHref(href)) {
        navigateToKaiBilling();
        return;
      }
      window.location.hash = stripAppPrefix(href);
    },
    replace: (href: string) => {
      if (href.startsWith("http")) {
        window.location.replace(href);
        return;
      }
      if (isBillingHref(href)) {
        navigateToKaiBilling();
        return;
      }
      // hash replace: setamos via location.replace pra não empilhar history
      const newUrl = `${window.location.pathname}${window.location.search}#${stripAppPrefix(href)}`;
      window.history.replaceState(null, "", newUrl);
      // dispara hashchange manual pq replaceState não dispara
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => {
      // re-trigger hashchange listeners
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    prefetch: () => {
      /* no-op */
    },
  };
}

export function usePathname(): string {
  // Reactivamente devolve o hash atual como "pathname" do Next (com prefixo /app).
  const [path, setPath] = useState<string>(() => {
    if (typeof window === "undefined") return "/app";
    const h = window.location.hash.replace(/^#/, "");
    return h ? `/app${h === "/" ? "" : h}` : "/app";
  });
  useEffect(() => {
    function onHash() {
      const h = window.location.hash.replace(/^#/, "");
      setPath(h ? `/app${h === "/" ? "" : h}` : "/app");
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return path;
}

/**
 * Next 16: useSearchParams() → ReadonlyURLSearchParams (do query string).
 *
 * Como o mini-router é hash-based (`#/create/abc/edit?template=manifesto`),
 * a query string do Next (`?template=...`) na verdade vive DENTRO do hash.
 * `window.location.search` permanece com a query do shell KAI (`?tab=viral-carrossel`).
 *
 * Aqui combinamos os dois: search params do hash TÊM precedência, e o que
 * vier do shell KAI fica como fallback. Reativo via hashchange + popstate.
 *
 * Pages que dependem disso (verificado 2026-05-09):
 *   - create-id/edit.tsx → searchParams.get("template") após /create/<id>/edit?template=manifesto
 *   - settings/page.tsx → searchParams.get("section")
 */
function readCombinedSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  // 1) Pega query do shell (do KAI Router)
  const fromShell = new URLSearchParams(window.location.search);
  // 2) Extrai query string DO hash (depois do `?` em `#/create/abc/edit?x=1`)
  const hash = window.location.hash.replace(/^#/, "");
  const qIdx = hash.indexOf("?");
  if (qIdx >= 0) {
    const fromHash = new URLSearchParams(hash.slice(qIdx + 1));
    // Hash tem precedência — sobrepõe duplicatas do shell.
    fromHash.forEach((v, k) => {
      fromShell.set(k, v);
    });
  }
  return fromShell;
}

export function useSearchParams(): URLSearchParams {
  const [params, setParams] = useState<URLSearchParams>(() => readCombinedSearchParams());
  useEffect(() => {
    function onChange() {
      setParams(readCombinedSearchParams());
    }
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
    };
  }, []);
  return params;
}

/**
 * Extrai params de rotas dinâmicas tipo `/create/<id>/edit` do hash atual.
 * Reativo: re-renderiza ao mudar hash. Heurística:
 *   - segmento 1: nome da page (`create`, `settings`, ...)
 *   - segmento 2: id (capturado como `id`)
 *   - segmento 3: action (não capturado — só visível via pathname)
 */
export function useParams<T extends Record<string, string | string[] | undefined>>(): T {
  const [params, setParams] = useState<T>(() => extractParams<T>());
  useEffect(() => {
    function onHash() {
      setParams(extractParams<T>());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return params;
}

function extractParams<T>(): T {
  if (typeof window === "undefined") return {} as T;
  // Tira `?query` antes de splitar — query vive no hash em rotas
  // tipo `#/create/abc/edit?template=manifesto`. Sem isso, parts[2]
  // seria `edit?template=manifesto` e id `abc` continuaria correto,
  // MAS se a query estiver entre id e action (raro), bagunça. Defensivo:
  const rawHash = window.location.hash.replace(/^#/, "");
  const qIdx = rawHash.indexOf("?");
  const path = qIdx >= 0 ? rawHash.slice(0, qIdx) : rawHash;
  const parts = path.split("/").filter(Boolean);
  // pages-app/create-id rotas: /create/<id>/<action>
  if (parts[0] === "create" && parts[1] && parts[1] !== "new") {
    return { id: parts[1] } as unknown as T;
  }
  return {} as T;
}

export function redirect(path: string): never {
  if (typeof window !== "undefined") {
    if (isBillingHref(path)) {
      navigateToKaiBilling();
    } else {
      window.location.hash = stripAppPrefix(path);
    }
  }
  throw new Error(`__NEXT_REDIRECT__:${path}`);
}

export function notFound(): never {
  throw new Error("__NEXT_NOT_FOUND__");
}
