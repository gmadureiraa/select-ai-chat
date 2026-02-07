import { useEffect } from "react";
import { useParams, Navigate, Outlet } from "react-router-dom";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceGuard } from "./WorkspaceGuard";

const KALEIDOS_SLUG = "kaleidos";

/**
 * WorkspaceRouter - Sistema interno Kaleidos
 * 
 * Força o uso do workspace "kaleidos" único.
 * Qualquer outro slug redireciona para /kaleidos.
 */
export const WorkspaceRouter = () => {
  const { slug } = useParams<{ slug: string }>();
  const { setSlug, workspace, isLoading, error } = useWorkspaceContext();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Always set to kaleidos
    setSlug(KALEIDOS_SLUG);
  }, [setSlug]);

  // If trying to access a different workspace, redirect to kaleidos
  if (slug && slug !== KALEIDOS_SLUG) {
    return <Navigate to="/kaleidos" replace />;
  }

  // Loading states
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Workspace not found (shouldn't happen with kaleidos)
  if (error || !workspace) {
    return <Navigate to="/404" replace />;
  }

  // Render the workspace content with guard
  return (
    <WorkspaceGuard>
      <Outlet />
    </WorkspaceGuard>
  );
};

export default WorkspaceRouter;
