import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Agents from "./pages/Agents";
import Assistant from "./pages/Assistant";
import Clients from "./pages/Clients";
import ClientChat from "./pages/ClientChat";
import ClientDashboard from "./pages/ClientDashboard";
import ClientPerformance from "./pages/ClientPerformance";
import PerformanceClients from "./pages/PerformanceClients";
import ImageGeneration from "./pages/ImageGeneration";
import ImageGallery from "./pages/ImageGallery";
import ClientContentLibrary from "./pages/ClientContentLibrary";
import ClientReferenceLibrary from "./pages/ClientReferenceLibrary";
import Automations from "./pages/Automations";
import ReverseEngineering from "./pages/ReverseEngineering";
import Activities from "./pages/Activities";
import ResearchLab from "./pages/ResearchLab";
import Settings from "./pages/Settings";
import SocialPublisher from "./pages/SocialPublisher";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
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
            path="/assistant"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Assistant />
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
            path="/client/:clientId/library"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ClientContentLibrary />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId/references"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ClientReferenceLibrary />
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
          <Route
            path="/reverse-engineering"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReverseEngineering />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Activities />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Settings />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/research-lab"
            element={
              <ProtectedRoute>
                <ResearchLab />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social-publisher"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SocialPublisher />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
