import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace, WorkspaceRole, WorkspaceMember } from "@/hooks/useWorkspace";

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export const useTeamMembers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ["team-members", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          id,
          workspace_id,
          user_id,
          role,
          created_at
        `)
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles for each member
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((member) => ({
        ...member,
        profile: profileMap.get(member.user_id) || null,
      })) as WorkspaceMember[];
    },
    enabled: !!workspace?.id,
  });

  const { data: invites = [], isLoading: isLoadingInvites } = useQuery({
    queryKey: ["team-invites", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      const { data, error } = await supabase
        .from("workspace_invites")
        .select("*")
        .eq("workspace_id", workspace.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WorkspaceInvite[];
    },
    enabled: !!workspace?.id,
  });

  const inviteMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: WorkspaceRole }) => {
      if (!workspace?.id) throw new Error("No workspace");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("workspace_invites")
        .insert({
          workspace_id: workspace.id,
          email: email.toLowerCase(),
          role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Este email já foi convidado");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invites"] });
      toast({
        title: "Convite enviado",
        description: "O membro receberá acesso ao fazer login com este email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao convidar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: WorkspaceRole }) => {
      const { data, error } = await supabase
        .from("workspace_members")
        .update({ role })
        .eq("id", memberId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: "Permissão atualizada",
        description: "A permissão do membro foi alterada.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível alterar a permissão.",
        variant: "destructive",
      });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: "Membro removido",
        description: "O membro foi removido do workspace.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o membro.",
        variant: "destructive",
      });
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("workspace_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invites"] });
      toast({
        title: "Convite cancelado",
        description: "O convite foi cancelado.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível cancelar o convite.",
        variant: "destructive",
      });
    },
  });

  return {
    members,
    invites,
    isLoadingMembers,
    isLoadingInvites,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvite,
  };
};
