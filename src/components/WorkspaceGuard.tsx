import { ReactNode } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Skeleton } from "@/components/ui/skeleton";
import PendingAccess from "@/pages/PendingAccess";

interface WorkspaceGuardProps {
  children: ReactNode;
}

export const WorkspaceGuard = ({ children }: WorkspaceGuardProps) => {
  const { workspace, isLoadingWorkspace } = useWorkspace();

  if (isLoadingWorkspace) {
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

  // User is not in any workspace - show pending access page
  if (!workspace) {
    return <PendingAccess />;
  }

  return <>{children}</>;
};
