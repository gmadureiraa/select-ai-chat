import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SkipLink } from "@/components/ui/skip-link";
import Kai from "./pages/Kai";
import Documentation from "./pages/Documentation";
import Help from "./pages/Help";
import AdminDashboard from "./pages/AdminDashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthOnlyRoute } from "@/components/AuthOnlyRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import Login from "./pages/Login";
import SimpleSignup from "./pages/SimpleSignup";
import NotFound from "./pages/NotFound";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { WorkspaceRouter } from "@/components/WorkspaceRouter";
import { TokenErrorProvider } from "@/hooks/useTokenError";
import { GlobalKAIProvider } from "@/contexts/GlobalKAIContext";
import { GlobalKAIAssistant } from "@/components/kai-global";
import { UpgradePromptProvider } from "@/hooks/useUpgradePrompt";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SkipLink />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <WorkspaceProvider>
            <TokenErrorProvider>
              <UpgradePromptProvider>
                <GlobalKAIProvider>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<SimpleSignup />} />
                    <Route path="/signup" element={<SimpleSignup />} />
                    <Route path="/help" element={<Help />} />
                    
                    {/* Root redirects to Kaleidos */}
                    <Route path="/" element={<Navigate to="/kaleidos" replace />} />
                    
                    {/* Super Admin route */}
                    <Route
                      path="/admin"
                      element={
                        <AuthOnlyRoute>
                          <SuperAdminRoute>
                            <AdminDashboard />
                          </SuperAdminRoute>
                        </AuthOnlyRoute>
                      }
                    />
                    
                    {/* Main app route - fixed to /kaleidos */}
                    <Route path="/kaleidos" element={<WorkspaceRouter />}>
                      <Route index element={<Kai />} />
                      <Route path="docs" element={<Documentation />} />
                    </Route>
                    
                    {/* Catch any other workspace slug and redirect to kaleidos */}
                    <Route path="/:slug" element={<Navigate to="/kaleidos" replace />} />
                    <Route path="/:slug/*" element={<Navigate to="/kaleidos" replace />} />
                    
                    {/* 404 */}
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  
                  {/* Global kAI Assistant - available on all authenticated pages */}
                  <GlobalKAIAssistant />
                </GlobalKAIProvider>
              </UpgradePromptProvider>
            </TokenErrorProvider>
          </WorkspaceProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
