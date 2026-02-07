import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useClients } from "@/hooks/useClients";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * usePlanLimits - Sistema interno Kaleidos
 * 
 * Este hook foi simplificado para sempre retornar limites ilimitados.
 * O sistema de planos foi desativado - todos os limites são baseados em roles.
 */
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
  isUnlimitedClients: boolean;
  isUnlimitedMembers: boolean;
  isCanvas: boolean;
  isPro: boolean;
}

export function usePlanLimits(): PlanLimits {
  const { workspace } = useWorkspaceContext();
  const { clients } = useClients();

  // Fetch member count (mantido para exibição informativa)
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

  const currentClients = clients?.length || 0;
  const currentMembers = memberCount || 0;
  const currentPendingInvites = pendingInvites || 0;

  // Sistema interno - limites ilimitados
  // Permissões de criação controladas por role em useWorkspace.ts
  return {
    maxClients: Infinity,
    maxMembers: Infinity,
    currentClients,
    currentMembers,
    pendingInvites: currentPendingInvites,
    canAddClient: true,
    canAddMember: true,
    clientsRemaining: Infinity,
    membersRemaining: Infinity,
    isLoading: isLoadingMembers || isLoadingInvites,
    isUnlimitedClients: true,
    isUnlimitedMembers: true,
    isCanvas: false,
    isPro: true,
  };
}
