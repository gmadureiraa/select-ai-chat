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

import { useEffect, useState, useMemo, lazy, Suspense, createContext, useContext } from "react";
import { Toaster as SonnerToaster } from "sonner";
import { AuthProvider } from "@sv/lib/auth-context";
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

const DashboardPage = lazy(() => import("./pages-app/dashboard")) as AnyPage;
const CarouselsPage = lazy(() => import("./pages-app/carousels")) as AnyPage;
const CreateNewPage = lazy(() => import("./pages-app/create-new")) as AnyPage;
const CreateIdEditPage = lazy(() => import("./pages-app/create-id/edit")) as AnyPage;
const CreateIdPreviewPage = lazy(() => import("./pages-app/create-id/preview")) as AnyPage;
const CreateIdConceptsPage = lazy(() => import("./pages-app/create-id/concepts")) as AnyPage;
const CreateIdTemplatesPage = lazy(() => import("./pages-app/create-id/templates")) as AnyPage;
const SettingsPage = lazy(() => import("./pages-app/settings/page")) as AnyPage;
const PlansPage = lazy(() => import("./pages-app/plans")) as AnyPage;
const HelpPage = lazy(() => import("./pages-app/help")) as AnyPage;
const OnboardingPage = lazy(() => import("./pages-app/onboarding")) as AnyPage;

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

function CenteredLoader() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--sv-ink)" }} />
    </div>
  );
}

/**
 * Helper — extrai `id` de `/create/<id>/<action>` e empacota em `Promise`
 * pra match com o pattern `params: Promise<{id}>` do Next 16 standalone.
 */
function paramsFromRoute(route: string): { params: Promise<{ id: string }> } {
  const match = route.match(/^\/create\/([^/]+)\//);
  const id = match?.[1] ?? "";
  return { params: Promise.resolve({ id }) };
}

function ActivePage({ route }: { route: string }) {
  // Mapping ad-hoc — replicar `app/app/<segment>` do Next standalone.
  // Ordem importa: rotas mais específicas primeiro.
  if (route.startsWith("/create/") && route.endsWith("/edit"))
    return <CreateIdEditPage {...paramsFromRoute(route)} />;
  if (route.startsWith("/create/") && route.endsWith("/preview"))
    return <CreateIdPreviewPage {...paramsFromRoute(route)} />;
  if (route.startsWith("/create/") && route.endsWith("/concepts"))
    return <CreateIdConceptsPage {...paramsFromRoute(route)} />;
  if (route.startsWith("/create/") && route.endsWith("/templates"))
    return <CreateIdTemplatesPage {...paramsFromRoute(route)} />;
  if (route === "/create/new" || route === "/create") return <CreateNewPage />;
  if (route === "/carousels") return <CarouselsPage />;
  if (route === "/settings" || route.startsWith("/settings/")) return <SettingsPage />;
  if (route === "/plans") return <PlansPage />;
  if (route === "/help") return <HelpPage />;
  if (route === "/onboarding") return <OnboardingPage />;
  // default → dashboard
  return <DashboardPage />;
}

interface MainAppProps {
  /** ID do cliente Kaleidos selecionado no shell (Sidebar do KAI). */
  clientId?: string | null;
  client?: { id?: string; name?: string } | null;
}

export default function MainApp({ clientId = null, client = null }: MainAppProps) {
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
            // Garante que tokens default do SV se aplicam — `--sv-paper`,
            // `--sv-ink`, etc estão em `:root` no globals.css mas sob
            // `sv-root` re-aplicamos algumas defaults pra contornar
            // overrides do KAI (background, color).
            background: "var(--sv-paper, #F7F5EF)",
            color: "var(--sv-ink, #0A0A0A)",
            minHeight: "100%",
            fontFamily: "var(--sv-sans)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ClientContextHeader context={clientCtx ?? null} variant="light" />
          <Suspense fallback={<CenteredLoader />}>
            <ActivePage route={route} />
          </Suspense>
          <SonnerToaster position="top-center" richColors closeButton />
        </div>
      </AuthProvider>
    </SVClientCtx.Provider>
  );
}

// Re-export named pra o lazy() do Kai.tsx que faz `.then((m) => ({ default: m.ViralSequenceTab }))`.
// Aceitamos as duas convenções (default + named).
export const ViralSequenceTab = MainApp;
