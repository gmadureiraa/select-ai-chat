import { Suspense } from "react";
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SkipLink } from "@/components/ui/skip-link";
import { PageLoader } from "@/components/ui/page-loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { WorkspaceRouter } from "@/components/WorkspaceRouter";
import { GlobalKAIProvider } from "@/contexts/GlobalKAIContext";
import { GlobalKAIAssistant } from "@/components/kai-global";

// Telemetry + addons globais — lazy. Não fazem parte do first paint e os
// chunks `@vercel/analytics`, `@vercel/speed-insights`, `cmdk`,
// PWA install/offline prompts vinham eager somando ~40-50kB raw no entry.
const Analytics = lazyWithRetry(() =>
  import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })),
);
const SpeedInsights = lazyWithRetry(() =>
  import("@vercel/speed-insights/react").then((m) => ({ default: m.SpeedInsights })),
);
const InstallPrompt = lazyWithRetry(() =>
  import("@/components/pwa/InstallPrompt").then((m) => ({ default: m.InstallPrompt })),
);
const OfflineIndicator = lazyWithRetry(() =>
  import("@/components/pwa/OfflineIndicator").then((m) => ({ default: m.OfflineIndicator })),
);
const CommandPalette = lazyWithRetry(() =>
  import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);

// Lazy-loaded pages — separa o bundle das rotas e diminui o index.js inicial.
// Cada rota vira um chunk independente carregado sob demanda.
const Kai = lazyWithRetry(() => import("./pages/Kai"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const SimpleSignup = lazyWithRetry(() => import("./pages/SimpleSignup"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ExportMadureira = lazyWithRetry(() => import("./pages/ExportMadureira"));
const NoWorkspacePage = lazyWithRetry(() => import("./pages/NoWorkspacePage"));
const Offline = lazyWithRetry(() => import("./pages/Offline"));
const ClientsListPage = lazyWithRetry(() =>
  import("@/components/clients/ClientsListPage").then((m) => ({
    default: m.ClientsListPage,
  })),
);

// QueryClient com defaults sãos pra Neon serverless (cold start ~1-2s).
// - refetchOnWindowFocus: false → evita cascade ao Cmd+Tab (era o gargalo real).
// - staleTime: 30s → se acessada recentemente, usa cache sem bater no DB.
// - refetchOnMount: true (default) → ao navegar pra rota, busca dados frescos
//   se stale. SEM ISSO, voltar pro Planning depois de visitar outra aba mostrava
//   cache incompleto (só conserta com Ctrl+F5).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function GlobalAddons() {
  // Cada addon vive num Suspense próprio com fallback null pra não bloquear
  // outros nem o restante da UI. CommandPalette só baixa o cmdk após primeiro
  // idle; Analytics/SpeedInsights idem; PWA prompts são quietos.
  return (
    <>
      <GlobalKAIAssistant />
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <Suspense fallback={null}>
        <InstallPrompt />
      </Suspense>
      <Suspense fallback={null}>
        <OfflineIndicator />
      </Suspense>
    </>
  );
}

// Redireciona pra /kaleidos preservando search + hash. Service Worker (sw.js)
// abre push notifications em URLs tipo `/${workspaceSlug}?tab=planning&openItem=X`,
// e antes esse redirect dropava todos os query params — o user caía em /kaleidos
// "limpo" e perdia a ação intent (audit 2026-05-16/frontend-ux-mobile.md P0-2).
function RedirectToKaleidos() {
  const { search, hash } = useLocation();
  return <Navigate to={`/kaleidos${search}${hash}`} replace />;
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="kai-theme"
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SkipLink />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <WorkspaceProvider>
              <GlobalKAIProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Navigate to="/signup" replace />} />
                    <Route path="/signup" element={<SimpleSignup />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    {/* Root redirects to Kaleidos (preserva query string e hash) */}
                    <Route path="/" element={<RedirectToKaleidos />} />

                    {/* Main app route - fixed to /kaleidos */}
                    <Route path="/kaleidos" element={<WorkspaceRouter />}>
                      <Route index element={<Kai />} />
                      {/* 2026-05-18 — rota antiga `/kaleidos/clients` agora
                          renderiza Kai com tab=clients pra preservar sidebar.
                          Bookmarks antigos continuam funcionando. */}
                      <Route path="clients" element={<Kai />} />
                    </Route>

                    {/* No workspace page */}
                    <Route path="/no-workspace" element={<NoWorkspacePage />} />

                    {/* Catch any other workspace slug e redireciona pra kaleidos.
                        Preserva search/hash pra push notifications (sw.js) e
                        deep links de Login funcionarem. */}
                    <Route path="/:slug" element={<RedirectToKaleidos />} />
                    <Route path="/:slug/*" element={<RedirectToKaleidos />} />

                    {/* Export temp */}
                    <Route path="/export-madureira" element={<ExportMadureira />} />
                    {/* Offline fallback (também servido via Service Worker) */}
                    <Route path="/offline" element={<Offline />} />
                    {/* 404 */}
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>

                <GlobalAddons />
              </GlobalKAIProvider>
              {/* Vercel telemetry — gratuitos no Hobby. Lazy + Suspense fallback null
                  pra que entrem após first paint sem competir por bandwidth crítica. */}
              <Suspense fallback={null}>
                <Analytics />
                <SpeedInsights />
              </Suspense>
            </WorkspaceProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
