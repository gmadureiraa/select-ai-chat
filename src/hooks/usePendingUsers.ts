import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceRole } from "@/hooks/useWorkspace";

export interface PendingUser {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
}

export const usePendingUsers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const { user } = useAuth();

  // Fetch users from profiles that are NOT in the current workspace and NOT rejected
  const { data: pendingUsers = [], isLoading } = useQuery({
    queryKey: ["pending-users", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      // Get all profiles (admins/owners can see all via RLS)
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get all members of current workspace
      const { data: workspaceMembers, error: membersError } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace.id);

      if (membersError) throw membersError;

      // Get all rejected users for current workspace
      const { data: rejectedUsers, error: rejectedError } = await supabase
        .from("workspace_rejected_users")
        .select("user_id")
        .eq("workspace_id", workspace.id);

      if (rejectedError) throw rejectedError;

      const memberUserIds = new Set(workspaceMembers?.map(m => m.user_id) || []);
      const rejectedUserIds = new Set(rejectedUsers?.map(r => r.user_id) || []);

      // Filter out users who are already members OR rejected
      const pending = allProfiles?.filter(p => 
        !memberUserIds.has(p.id) && !rejectedUserIds.has(p.id)
      ) || [];

      return pending as PendingUser[];
    },
    enabled: !!workspace?.id,
  });

  // Add a pending user to the workspace
  const addUserToWorkspace = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: WorkspaceRole }) => {
      if (!workspace?.id) throw new Error("No workspace");

      const { data, error } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users", workspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["team-members", workspace?.id] });
      toast({
        title: "Usuário adicionado",
        description: "O usuário agora faz parte do workspace.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject a pending user (add to rejected list)
  const rejectUser = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      if (!workspace?.id || !user?.id) throw new Error("No workspace or user");

      const { data, error } = await supabase
        .from("workspace_rejected_users")
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          rejected_by: user.id,
          reason,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users", workspace?.id] });
      toast({
        title: "Usuário recusado",
        description: "O usuário não aparecerá mais na lista de pendentes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao recusar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unreject a user (remove from rejected list)
  const unrejectUser = useMutation({
    mutationFn: async (userId: string) => {
      if (!workspace?.id) throw new Error("No workspace");

      const { error } = await supabase
        .from("workspace_rejected_users")
        .delete()
        .eq("workspace_id", workspace.id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users", workspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["rejected-users", workspace?.id] });
      toast({
        title: "Usuário restaurado",
        description: "O usuário aparecerá novamente na lista de pendentes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao restaurar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get rejected users list
  const { data: rejectedUsers = [], isLoading: isLoadingRejected } = useQuery({
    queryKey: ["rejected-users", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      const { data, error } = await supabase
        .from("workspace_rejected_users")
        .select(`
          id,
          user_id,
          rejected_at,
          reason
        `)
        .eq("workspace_id", workspace.id)
        .order("rejected_at", { ascending: false });

      if (error) throw error;

      // Get profile info for rejected users
      if (!data || data.length === 0) return [];

      const userIds = data.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) || null,
      }));
    },
    enabled: !!workspace?.id,
  });

  return {
    pendingUsers,
    isLoading,
    pendingCount: pendingUsers.length,
    addUserToWorkspace,
    rejectUser,
    unrejectUser,
    rejectedUsers,
    isLoadingRejected,
  };
};
