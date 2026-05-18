/**
 * MainApp — entry point do Sequência Viral standalone, integrado dentro
 * do tab `<ViralSequenceTab>` do KAI.
 *
 * Estratégia "cópia literal":
 *   - Mantém os componentes/CSS/fontes/tokens do standalone original
 *     (Atelier, Gridlite, Plus Jakarta, Instrument Serif, paper textures,
 *     REC coral #FF3D2E etc).
 *   - Pages do standalone (`app/app/*`) ficam em `pages-app/` e são
 *     renderizadas via mini-router interno baseado em URL hash
 *     (`#/dashboard`, `#/create`, `#/carousels` etc) — não conflita
 *     com o react-router do KAI (que governa rotas top-level).
 *   - Importa `styles/globals.css` no top — todos os tokens e classes
 *     ficam disponíveis. CSS não é Module, escopo global, mas
 *     prefixos `sv-*` evitam colisão com o KAI.
 *   - `<AuthProvider>` do SV é um pass-through: usa o supabase do KAI
 *     (Neon Auth), tenta carregar `profiles` (table que pode não
 *     existir no KAI Neon DB) — falha graciosa.
 *
 * `clientId` / `client` (props passadas pelo Kai.tsx) são repassadas via
 * contexto pra que features futuras possam scopar geração por cliente.
 */

import { useEffect, useState, useMemo, Suspense, createContext, useContext, type ReactNode } from "react";
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Toaster as SonnerToaster } from "sonner";
import { AuthProvider, useAuth } from "@sv/lib/auth-context";
import { Loader2 } from "lucide-react";

// KAI integration: header com nome do cliente + hook de contexto.
import { useClientWorkspaceContext } from "@/components/kai/viral/lib/use-client-workspace-context";
import { ClientContextHeader } from "@/components/kai/viral/ClientContextHeader";

// Tokens, paper textures, brutalist shadows, REC coral, fonts faces — IMPORT
// no top pra que TODA a UI dentro de viral-sv-original veja `var(--sv-*)`,
// `.sv-display`, `.sv-eyebrow`, etc. Importar só dentro do MainApp evita
// poluir as outras tabs do KAI com Atelier/Gridlite globais.
import "./styles/globals.css";

// Pages — lazy pra cada uma virar um chunk próprio (evita 200kb extra
// no first-paint do KAI quando a tab ainda nem foi clicada).
//
// Cast `as ComponentType<any>` pq as pages do Next 16 declaram
// `params: Promise<...>` na assinatura — incompatível com TSX comum.
// Em runtime passamos `params` como Promise.resolve(...) e o `use(props.params)`
// dentro da page resolve sincronamente (`use()` aceita Promise resolvida).
import type { ComponentType } from "react";

type AnyPage = ComponentType<any>;

const DashboardPage = lazyWithRetry(() => import("./pages-app/dashboard")) as AnyPage;
const CarouselsPage = lazyWithRetry(() => import("./pages-app/carousels")) as AnyPage;
const CreateNewPage = lazyWithRetry(() => import("./pages-app/create-new")) as AnyPage;
const CreateIdEditPage = lazyWithRetry(() => import("./pages-app/create-id/edit")) as AnyPage;
const CreateIdPreviewPage = lazyWithRetry(() => import("./pages-app/create-id/preview")) as AnyPage;
const CreateIdConceptsPage = lazyWithRetry(() => import("./pages-app/create-id/concepts")) as AnyPage;
const CreateIdTemplatesPage = lazyWithRetry(() => import("./pages-app/create-id/templates")) as AnyPage;
const SettingsPage = lazyWithRetry(() => import("./pages-app/settings/page")) as AnyPage;
const PlansPage = lazyWithRetry(() => import("./pages-app/plans")) as AnyPage;
const HelpPage = lazyWithRetry(() => import("./pages-app/help")) as AnyPage;
const OnboardingPage = lazyWithRetry(() => import("./pages-app/onboarding")) as AnyPage;

// ─── Client context (KAI integration) ────────────────────────────────────
interface SVClientContext {
  clientId: string | null;
  client: { id?: string; name?: string } | null;
}
const SVClientCtx = createContext<SVClientContext>({ clientId: null, client: null });
export function useSVClient(): SVClientContext {
  return useContext(SVClientCtx);
}

// ─── Mini router via hash (#/dashboard, #/create, #/create/abc/edit) ───
function useHashRoute(): string {
  const [route, setRoute] = useState<string>(() => {
    if (typeof window === "undefined") return "/";
    return window.location.hash.replace(/^#/, "") || "/";
  });
  useEffect(() => {
    function onHash() {
      setRoute(window.location.hash.replace(/^#/, "") || "/");
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

/**
 * AuthGate — espera o useAuth do SV resolver antes de renderizar pages.
 * Sem isso, pages renderizavam com `user=null` por 1 frame e dispatchavam
 * `loadCarousels` que retorna [] (lista vazia) — UX "0 carrosseis" mesmo
 * logado, até refetch após onAuthStateChange.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return <CenteredLoader />;
  return <>{children}</>;
}

function CenteredLoader() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--sv-ink)" }} />
    </div>
  );
}

/**
 * Helper — extrai `id` de `/create/<id>/<action>` e passa como objeto plain.
 *
 * O original Next 16 standalone recebia `params: Promise<{id}>` (App Router
 * async params). Mas as pages aqui destructuram síncrono — `(props.params as
 * unknown as { id: string })`. Encapsular numa Promise quebrava o destructure
 * (id virava undefined → useDraft no-op → "Rascunho não encontrado.").
 *
 * Versão atual: passa objeto plain síncrono. Pages destructuram direto.
 */
function paramsFromRoute(route: string): { params: { id: string } } {
  const match = route.match(/^\/create\/([^/]+)\//);
  const id = match?.[1] ?? "";
  return { params: { id } };
}

/**
 * SubNav fina embaixo do ClientContextHeader — mostra as 2 ações canônicas
 * (Listagem + Novo) e botão Voltar quando a rota é interna. Sem isso o user
 * fica preso na tela de Edit/Preview/Concepts sem caminho claro pra listagem.
 *
 * Mantém estética SV (mono caps, ink underline) pra integrar com o resto.
 */
function SubNav({ route }: { route: string }) {
  const qIdx = route.indexOf("?");
  const path = qIdx >= 0 ? route.slice(0, qIdx) : route;
  // Não mostra subnav nas rotas top-level (já têm CTA primário óbvio).
  const isList = path === "/carousels" || path === "/" || path === "";
  const isCreateNew = path === "/create/new" || path === "/create";

  function go(href: string) {
    if (typeof window === "undefined") return;
    window.location.hash = href;
  }

  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-2 md:px-6"
      style={{
        borderColor: "var(--sv-ink, #0A0A0A)",
        background: "var(--sv-paper, #F7F5EF)",
        fontFamily: "var(--sv-mono)",
        fontSize: 10.5,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      <button
        type="button"
        onClick={() => go("/carousels")}
        style={{
          color: isList ? "var(--sv-ink)" : "var(--sv-muted)",
          fontWeight: isList ? 700 : 500,
          textDecoration: isList ? "underline" : "none",
          textUnderlineOffset: 4,
        }}
      >
        Carrosséis
      </button>
      <span style={{ color: "var(--sv-muted)" }}>·</span>
      <button
        type="button"
        onClick={() => go("/create/new")}
        style={{
          color: isCreateNew ? "var(--sv-ink)" : "var(--sv-muted)",
          fontWeight: isCreateNew ? 700 : 500,
          textDecoration: isCreateNew ? "underline" : "none",
          textUnderlineOffset: 4,
        }}
      >
        + Novo
      </button>
      {!isList && !isCreateNew && (
        <button
          type="button"
          onClick={() => go("/carousels")}
          className="ml-auto"
          style={{ color: "var(--sv-muted)" }}
        >
          ← Voltar pra lista
        </button>
      )}
    </div>
  );
}

function ActivePage({ route }: { route: string }) {
  // Strip query string antes de matchar — query vive no hash em rotas tipo
  // `#/create/abc/edit?template=manifesto`. Sem isso, `endsWith("/edit")`
  // falhava e caía no fallback CarouselsPage. `useSearchParams()` no shim
  // ainda lê o `?template=...` do hash em runtime.
  const qIdx = route.indexOf("?");
  const path = qIdx >= 0 ? route.slice(0, qIdx) : route;

  // Mapping ad-hoc — replicar `app/app/<segment>` do Next standalone.
  // Ordem importa: rotas mais específicas primeiro.
  if (path.startsWith("/create/") && path.endsWith("/edit"))
    return <CreateIdEditPage {...paramsFromRoute(path)} />;
  if (path.startsWith("/create/") && path.endsWith("/preview"))
    return <CreateIdPreviewPage {...paramsFromRoute(path)} />;
  if (path.startsWith("/create/") && path.endsWith("/concepts"))
    return <CreateIdConceptsPage {...paramsFromRoute(path)} />;
  if (path.startsWith("/create/") && path.endsWith("/templates"))
    return <CreateIdTemplatesPage {...paramsFromRoute(path)} />;
  if (path === "/create/new" || path === "/create") return <CreateNewPage />;
  if (path === "/carousels") return <CarouselsPage />;
  if (path === "/settings" || path.startsWith("/settings/")) return <SettingsPage />;
  if (path === "/plans") return <PlansPage />;
  if (path === "/help") return <HelpPage />;
  if (path === "/onboarding") return <OnboardingPage />;
  if (path === "/dashboard") return <DashboardPage />;
  // default → carrosseis (entry point principal — KAI 2026-05-08).
  // Antes era /dashboard, mas pra modo interno Kaleidos a primeira tela
  // útil é a lista de carrosseis com botão "+ Novo carrossel" visível.
  return <CarouselsPage />;
}

interface MainAppProps {
  /** ID do cliente Kaleidos selecionado no shell (Sidebar do KAI). */
  clientId?: string | null;
  client?: { id?: string; name?: string } | null;
  /** Quando vindo de um deep-link (?carouselId=...) abre direto esse carrossel. */
  carouselId?: string | null;
}

export default function MainApp({ clientId = null, client = null, carouselId = null }: MainAppProps) {
  const route = useHashRoute();
  const ctx = useMemo<SVClientContext>(() => ({ clientId, client }), [clientId, client]);
  // Carrega contexto KAI do cliente — só pra header. Pages internas
  // chamam o hook de novo (TanStack cacheia 5min, então é grátis).
  const { data: clientCtx } = useClientWorkspaceContext(clientId);

  return (
    <SVClientCtx.Provider value={ctx}>
      <AuthProvider>
        <div
          className="sv-root"
          style={{
            // Container do SV — flex column com scroll interno.
            // Pais (KAI shell) são overflow:hidden, então o scroll precisa
            // morar AQUI dentro. Arquitetura clássica flex-column:
            //   - sv-root: overflow:hidden (não scroll própria)
            //   - ClientContextHeader + SubNav: flex-shrink:0 (altura fixa)
            //   - sv-scroll: flex:1 min-h:0 overflow-y:auto → SCROLL AQUI
            //
            // Tentativa anterior (overflow:auto no sv-root direto) NÃO
            // funcionava porque flex items têm min-height:auto por default,
            // forçando o container a expandir além do height:100% e anulando
            // o overflow:auto. min-height:0 no filho scrollable é o
            // workaround canônico do flexbox.
            background: "var(--sv-paper, #F7F5EF)",
            color: "var(--sv-ink, #0A0A0A)",
            height: "100%",
            overflow: "hidden",
            fontFamily: "var(--sv-sans)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <ClientContextHeader context={clientCtx ?? null} variant="light" />
            <SubNav route={route} />
          </div>
          <div
            className="sv-scroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              // WebKit smooth scroll em mobile.
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Suspense fallback={<CenteredLoader />}>
              <AuthGate>
                <ActivePage route={route} />
              </AuthGate>
            </Suspense>
          </div>
          <SonnerToaster position="top-center" richColors closeButton />
        </div>
      </AuthProvider>
    </SVClientCtx.Provider>
  );
}

// Re-export named pra o lazy() do Kai.tsx que faz `.then((m) => ({ default: m.ViralSequenceTab }))`.
// Aceitamos as duas convenções (default + named).
export const ViralSequenceTab = MainApp;
