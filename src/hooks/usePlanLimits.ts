import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useClients } from "@/hooks/useClients";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PlanLimits {
  maxClients: number;
  maxMembers: number;
  currentClients: number;
  currentMembers: number;
  pendingInvites: number;
  canAddClient: boolean;
  canAddMember: boolean;
  clientsRemaining: number;
  membersRemaining: number;
  isLoading: boolean;
}

export function usePlanLimits(): PlanLimits {
  const { workspace, subscription } = useWorkspaceContext();
  const { clients } = useClients();

  // Fetch member count
  const { data: memberCount, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["member-count", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return 0;
      const { count, error } = await supabase
        .from("workspace_members")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!workspace?.id,
  });

  // Fetch pending invites count
  const { data: pendingInvites, isLoading: isLoadingInvites } = useQuery({
    queryKey: ["pending-invites-count", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return 0;
      const { count, error } = await supabase
        .from("workspace_invites")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .is("accepted_at", null);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!workspace?.id,
  });

  const maxClients = subscription?.plan?.max_clients || 1;
  const maxMembers = subscription?.plan?.max_members || 1;
  const currentClients = clients?.length || 0;
  const currentMembers = memberCount || 0;
  const currentPendingInvites = pendingInvites || 0;

  // Members includes current members + pending invites
  const totalPotentialMembers = currentMembers + currentPendingInvites;

  return {
    maxClients,
    maxMembers,
    currentClients,
    currentMembers,
    pendingInvites: currentPendingInvites,
    canAddClient: currentClients < maxClients,
    canAddMember: totalPotentialMembers < maxMembers,
    clientsRemaining: Math.max(0, maxClients - currentClients),
    membersRemaining: Math.max(0, maxMembers - totalPotentialMembers),
    isLoading: isLoadingMembers || isLoadingInvites,
  };
}
