import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { WorkspaceRole, WorkspaceMember } from "@/hooks/useWorkspace";

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
  const { workspace } = useWorkspaceContext();

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
    mutationFn: async ({ email, role, clientIds, clientNames }: { email: string; role: WorkspaceRole; clientIds?: string[]; clientNames?: string[] }) => {
      if (!workspace?.id) throw new Error("No workspace");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get inviter profile
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      // Use RPC to add member directly if user exists, or create invite if not
      const { data: result, error } = await supabase.rpc("add_workspace_member_or_invite", {
        p_workspace_id: workspace.id,
        p_email: email.toLowerCase(),
        p_role: role,
        p_invited_by: user.id,
        p_client_ids: clientIds || null,
      });

      if (error) {
        throw error;
      }

      const status = (result as any)?.status;

      // If user was added directly as member, no email needed
      if (status === "member_added") {
        return { status: "member_added", ...(typeof result === 'object' && result !== null ? result : {}) };
      }

      // If already a member, throw friendly error
      if (status === "already_member") {
        throw new Error("Este usuário já é membro do workspace");
      }

      // User doesn't exist yet - send invite email
      if (status === "invite_created") {
        try {
          await supabase.functions.invoke("send-invite-email", {
            body: {
              email: email.toLowerCase(),
              workspaceName: workspace.name,
              workspaceSlug: workspace.slug,
              inviterName: inviterProfile?.full_name || inviterProfile?.email || "Um administrador",
              role,
              clientNames: clientNames || [],
            },
          });
        } catch (emailError) {
          console.error("Error sending invite email:", emailError);
          // Don't throw - invite was created successfully, just log the email error
        }
      }

      return { status: "invite_created", ...(typeof result === 'object' && result !== null ? result : {}) };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team-members", workspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["team-invites", workspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["invite-clients"] });
      queryClient.invalidateQueries({ queryKey: ["all-member-client-access", workspace?.id] });
      
      const status = (data as any)?.status;
      if (status === "member_added") {
        toast({
          title: "Membro adicionado",
          description: "O usuário foi adicionado ao workspace com sucesso.",
        });
      } else {
        toast({
          title: "Convite enviado",
          description: "O email de convite foi enviado com sucesso.",
        });
      }
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
      queryClient.invalidateQueries({ queryKey: ["team-members", workspace?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["team-members", workspace?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["team-invites", workspace?.id] });
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
