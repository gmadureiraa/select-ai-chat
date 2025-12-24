import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Kai2 from "./pages/Kai2";
import Documentation from "./pages/Documentation";
import LandingPage from "./pages/LandingPage";
import AdminDashboard from "./pages/AdminDashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { WorkspaceRouter } from "@/components/WorkspaceRouter";
import { WorkspaceRedirect } from "@/components/WorkspaceRedirect";
import { TokenErrorProvider } from "@/hooks/useTokenError";

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
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/page" element={<LandingPage />} />
                
                {/* Public landing page */}
                <Route path="/" element={<LandingPage />} />
                
                {/* Super Admin route */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <SuperAdminRoute>
                        <AdminDashboard />
                      </SuperAdminRoute>
                    </ProtectedRoute>
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
                
                {/* Workspace routes with slug */}
                <Route path="/:slug" element={<WorkspaceRouter />}>
                  <Route index element={<Kai2 />} />
                  <Route path="docs" element={<Documentation />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                
                {/* 404 */}
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TokenErrorProvider>
          </WorkspaceProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
