import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceGuard } from "@/components/WorkspaceGuard";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // After auth check, verify workspace membership
  return <WorkspaceGuard>{children}</WorkspaceGuard>;
};
