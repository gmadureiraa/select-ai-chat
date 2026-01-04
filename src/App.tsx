import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Kai from "./pages/Kai";
import Documentation from "./pages/Documentation";
import LandingPage from "./pages/LandingPage";
import AdminDashboard from "./pages/AdminDashboard";
import AgentsExplorer from "./pages/AgentsExplorer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthOnlyRoute } from "@/components/AuthOnlyRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import JoinWorkspace from "./pages/JoinWorkspace";
import WorkspaceLogin from "./pages/WorkspaceLogin";
import NotFound from "./pages/NotFound";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { WorkspaceRouter } from "@/components/WorkspaceRouter";
import { WorkspaceRedirect } from "@/components/WorkspaceRedirect";
import { TokenErrorProvider } from "@/hooks/useTokenError";
import { GlobalKAIProvider } from "@/contexts/GlobalKAIContext";
import { GlobalKAIAssistant } from "@/components/kai-global";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <WorkspaceProvider>
            <TokenErrorProvider>
              <GlobalKAIProvider>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/page" element={<LandingPage />} />
                  
                  {/* Public landing page */}
                  <Route path="/" element={<LandingPage />} />
                  
                  {/* Super Admin route - uses AuthOnlyRoute instead of ProtectedRoute to skip workspace check */}
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
                  
                  {/* Redirect to workspace for authenticated users */}
                  <Route
                    path="/app"
                    element={
                      <ProtectedRoute>
                        <WorkspaceRedirect />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Workspace auth routes */}
                  <Route path="/:slug/join" element={<JoinWorkspace />} />
                  <Route path="/:slug/login" element={<WorkspaceLogin />} />
                  
                  {/* Workspace routes with slug */}
                  <Route path="/:slug" element={<WorkspaceRouter />}>
                    <Route index element={<Kai />} />
                    <Route path="docs" element={<Documentation />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="agents" element={<AgentsExplorer />} />
                  </Route>
                  
                  {/* 404 */}
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                
                {/* Global kAI Assistant - available on all authenticated pages */}
                <GlobalKAIAssistant />
              </GlobalKAIProvider>
            </TokenErrorProvider>
          </WorkspaceProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
