import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Agents from "./pages/Agents";
import Clients from "./pages/Clients";
import ClientChat from "./pages/ClientChat";
import ClientDashboard from "./pages/ClientDashboard";
import ClientPerformance from "./pages/ClientPerformance";
import PerformanceClients from "./pages/PerformanceClients";
import ImageGeneration from "./pages/ImageGeneration";
import ImageGallery from "./pages/ImageGallery";
import Automations from "./pages/Automations";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/agents" replace />} />
          <Route
            path="/agents"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Agents />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Clients />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PerformanceClients />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ClientDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId/performance"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ClientPerformance />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId/image-gen"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ImageGeneration />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId/gallery"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ImageGallery />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:clientId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ClientChat />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Automations />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
