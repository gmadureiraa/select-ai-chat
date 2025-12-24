import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Skeleton } from "@/components/ui/skeleton";

interface SuperAdminRouteProps {
  children: ReactNode;
}

export const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  const { isSuperAdmin, isLoading } = useSuperAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};
