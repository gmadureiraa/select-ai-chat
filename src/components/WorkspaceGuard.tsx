import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingAccessOverlay } from "@/components/PendingAccessOverlay";

interface WorkspaceGuardProps {
  children: ReactNode;
}

export const WorkspaceGuard = ({ children }: WorkspaceGuardProps) => {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspaceContext();
  const { user, loading: authLoading } = useAuth();

  // Check if user is member of this specific workspace
  const { data: isMember, isLoading: isCheckingMembership } = useQuery({
    queryKey: ["workspace-membership", workspace?.id, user?.id],
    queryFn: async () => {
      if (!workspace?.id || !user?.id) return false;
      
      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, role")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[WorkspaceGuard] Error checking membership:", error);
        return false;
      }

      return !!data;
    },
    enabled: !!workspace?.id && !!user?.id,
  });

  const isLoading = authLoading || isLoadingWorkspace || isCheckingMembership;

  if (isLoading) {
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

  // User is not a member of this workspace - show pending access overlay
  if (!isMember) {
    return <PendingAccessOverlay>{children}</PendingAccessOverlay>;
  }

  return <>{children}</>;
};
