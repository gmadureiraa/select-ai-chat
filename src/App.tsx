import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import KaiHub from "./pages/KaiHub";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Activities from "./pages/Activities";
import ResearchLab from "./pages/ResearchLab";
import Settings from "./pages/Settings";
import SocialPublisher from "./pages/SocialPublisher";
import KnowledgeBase from "./pages/KnowledgeBase";
import AgentBuilder from "./pages/AgentBuilder";
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
            <Route path="/" element={<Navigate to="/kai" replace />} />
            <Route
              path="/kai"
              element={
                <ProtectedRoute>
                  <KaiHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activities"
              element={
                <ProtectedRoute>
                  <Activities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-base"
              element={
                <ProtectedRoute>
                  <KnowledgeBase />
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
                  <SocialPublisher />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent-builder"
              element={
                <ProtectedRoute>
                  <AgentBuilder />
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
