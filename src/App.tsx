import { lazy, Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SkipLink } from "@/components/ui/skip-link";
import { PageLoader } from "@/components/ui/page-loader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { WorkspaceRouter } from "@/components/WorkspaceRouter";
import { GlobalKAIProvider } from "@/contexts/GlobalKAIContext";
import { GlobalKAIAssistant } from "@/components/kai-global";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { CommandPalette } from "@/components/CommandPalette";

// Lazy-loaded pages — separa o bundle das rotas e diminui o index.js inicial.
// Cada rota vira um chunk independente carregado sob demanda.
const Kai = lazy(() => import("./pages/Kai"));
const Login = lazy(() => import("./pages/Login"));
const SimpleSignup = lazy(() => import("./pages/SimpleSignup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ExportMadureira = lazy(() => import("./pages/ExportMadureira"));
const NoWorkspacePage = lazy(() => import("./pages/NoWorkspacePage"));
const Offline = lazy(() => import("./pages/Offline"));
const ClientsListPage = lazy(() =>
  import("@/components/clients/ClientsListPage").then((m) => ({
    default: m.ClientsListPage,
  })),
);

const queryClient = new QueryClient();

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
                    <Route path="/register" element={<SimpleSignup />} />
                    <Route path="/signup" element={<SimpleSignup />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    {/* Root redirects to Kaleidos */}
                    <Route path="/" element={<Navigate to="/kaleidos" replace />} />

                    {/* Main app route - fixed to /kaleidos */}
                    <Route path="/kaleidos" element={<WorkspaceRouter />}>
                      <Route index element={<Kai />} />
                      <Route path="clients" element={<ClientsListPage />} />
                    </Route>

                    {/* No workspace page */}
                    <Route path="/no-workspace" element={<NoWorkspacePage />} />

                    {/* Catch any other workspace slug and redirect to kaleidos */}
                    <Route path="/:slug" element={<Navigate to="/kaleidos" replace />} />
                    <Route path="/:slug/*" element={<Navigate to="/kaleidos" replace />} />

                    {/* Export temp */}
                    <Route path="/export-madureira" element={<ExportMadureira />} />
                    {/* Offline fallback (também servido via Service Worker) */}
                    <Route path="/offline" element={<Offline />} />
                    {/* 404 */}
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>

                {/* Global kAI Assistant - available on all authenticated pages */}
                <GlobalKAIAssistant />

                {/* Global Cmd+K Command Palette */}
                <CommandPalette />

                {/* PWA: install prompt e indicador de offline (globais) */}
                <InstallPrompt />
                <OfflineIndicator />
              </GlobalKAIProvider>
              {/* Vercel telemetry — gratuitos no Hobby */}
              <Analytics />
              <SpeedInsights />
            </WorkspaceProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
