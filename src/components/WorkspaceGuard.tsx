import { ReactNode, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  // Check if user is member of this specific workspace
  const { data: membership, isLoading: isCheckingMembership, refetch: refetchMembership } = useQuery({
    queryKey: ["workspace-membership", workspace?.id, user?.id],
    queryFn: async () => {
      if (!workspace?.id || !user?.id) return null;
      
      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, role")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[WorkspaceGuard] Error checking membership:", error);
        return null;
      }

      return data;
    },
    enabled: !!workspace?.id && !!user?.id,
  });

  // Check and accept pending invite if not a member
  const { data: inviteAccepted, isLoading: isCheckingInvite } = useQuery({
    queryKey: ["pending-invite-check", workspace?.id, user?.id],
    queryFn: async () => {
      if (!workspace?.id || !user?.id) return false;
      
      // Call RPC to check and accept pending invite
      const { data, error } = await supabase
        .rpc("accept_pending_invite", {
          p_workspace_id: workspace.id,
          p_user_id: user.id
        });
      
      if (error) {
        console.error("[WorkspaceGuard] Error checking/accepting invite:", error);
        return false;
      }
      
      return data === true;
    },
    enabled: !!workspace?.id && !!user?.id && !membership && !isCheckingMembership,
  });

  // Refetch membership if invite was accepted
  useEffect(() => {
    if (inviteAccepted === true) {
      refetchMembership();
    }
  }, [inviteAccepted, refetchMembership]);

  // Check if user already has an access request
  const { data: accessRequest, isLoading: isCheckingRequest } = useQuery({
    queryKey: ["workspace-access-request", workspace?.id, user?.id],
    queryFn: async () => {
      if (!workspace?.id || !user?.id) return null;
      
      const { data, error } = await supabase
        .from("workspace_access_requests")
        .select("id, status")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[WorkspaceGuard] Error checking access request:", error);
        return null;
      }

      return data;
    },
    enabled: !!workspace?.id && !!user?.id && !membership,
  });

  // Mutation to create access request if needed
  const createAccessRequest = useMutation({
    mutationFn: async () => {
      if (!workspace?.id || !user?.id) return;
      
      const { error } = await supabase
        .from("workspace_access_requests")
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          status: "pending",
          message: "Solicitação automática de acesso",
        });

      if (error && error.code !== "23505") { // Ignore duplicate key error
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["workspace-access-request", workspace?.id, user?.id] 
      });
    },
  });

  // Auto-create access request if user is not a member and doesn't have a request
  useEffect(() => {
    if (
      workspace?.id && 
      user?.id && 
      !membership && 
      !accessRequest && 
      !isCheckingMembership && 
      !isCheckingRequest
    ) {
      createAccessRequest.mutate();
    }
  }, [workspace?.id, user?.id, membership, accessRequest, isCheckingMembership, isCheckingRequest]);

  const isMember = !!membership;
  const isLoading = authLoading || isLoadingWorkspace || isCheckingMembership || isCheckingInvite || isCheckingRequest;

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
    return (
      <PendingAccessOverlay 
        workspaceName={workspace?.name || ""} 
        requestStatus={accessRequest?.status || "pending"}
      >
        {children}
      </PendingAccessOverlay>
    );
  }

  return <>{children}</>;
};
