import { useEffect } from "react";
import { useParams, Navigate, Outlet } from "react-router-dom";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceGuard } from "./WorkspaceGuard";

export const WorkspaceRouter = () => {
  const { slug } = useParams<{ slug: string }>();
  const { setSlug, workspace, isLoading, error } = useWorkspaceContext();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (slug) {
      setSlug(slug);
    }
  }, [slug, setSlug]);

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

  // Not authenticated - redirect to workspace login
  if (!user) {
    return <Navigate to={`/${slug}/login`} replace />;
  }

  // Workspace not found
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
