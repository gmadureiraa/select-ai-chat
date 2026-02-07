import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * WorkspaceRedirect - Sistema interno Kaleidos
 * 
 * Sempre redireciona para /kaleidos (workspace único).
 * Não há mais lógica de buscar workspace do usuário.
 */
export const WorkspaceRedirect = () => {
  const { user, loading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure auth state is settled
    if (!authLoading) {
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  if (authLoading || !isReady) {
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

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Always redirect to Kaleidos
  return <Navigate to="/kaleidos" replace />;
};

export default WorkspaceRedirect;
