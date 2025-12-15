import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MemberClientAccess {
  id: string;
  workspace_member_id: string;
  client_id: string;
  created_at: string;
}

export const useMemberClientAccess = (workspaceMemberId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get client access for a specific member
  const { data: memberClients = [], isLoading } = useQuery({
    queryKey: ["member-client-access", workspaceMemberId],
    queryFn: async () => {
      if (!workspaceMemberId) return [];

      const { data, error } = await supabase
        .from("workspace_member_clients")
        .select("*")
        .eq("workspace_member_id", workspaceMemberId);

      if (error) throw error;
      return data as MemberClientAccess[];
    },
    enabled: !!workspaceMemberId,
  });

  // Update member's client access (replace all)
  const updateMemberClients = useMutation({
    mutationFn: async ({ 
      memberId, 
      clientIds 
    }: { 
      memberId: string; 
      clientIds: string[];
    }) => {
      // First, delete all existing access
      const { error: deleteError } = await supabase
        .from("workspace_member_clients")
        .delete()
        .eq("workspace_member_id", memberId);

      if (deleteError) throw deleteError;

      // If no clients selected, member has access to all (default behavior)
      if (clientIds.length === 0) {
        return [];
      }

      // Insert new access records
      const accessRecords = clientIds.map(clientId => ({
        workspace_member_id: memberId,
        client_id: clientId,
      }));

      const { data, error: insertError } = await supabase
        .from("workspace_member_clients")
        .insert(accessRecords)
        .select();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-client-access"] });
      toast({
        title: "Acesso atualizado",
        description: "As permissões de cliente foram atualizadas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar acesso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    memberClients,
    isLoading,
    updateMemberClients,
    clientIds: memberClients.map(mc => mc.client_id),
  };
};

// Hook to get all member-client access for a workspace (for admin view)
export const useAllMemberClientAccess = (workspaceId?: string) => {
  return useQuery({
    queryKey: ["all-member-client-access", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      // Get all members of the workspace
      const { data: members, error: membersError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId);

      if (membersError) throw membersError;

      const memberIds = members.map(m => m.id);
      
      if (memberIds.length === 0) return [];

      // Get all client access records
      const { data, error } = await supabase
        .from("workspace_member_clients")
        .select("*")
        .in("workspace_member_id", memberIds);

      if (error) throw error;
      return data as MemberClientAccess[];
    },
    enabled: !!workspaceId,
  });
};
