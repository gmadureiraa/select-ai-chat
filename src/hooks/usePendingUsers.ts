import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
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

  // Fetch users from profiles that are NOT in the current workspace
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

      const memberUserIds = new Set(workspaceMembers?.map(m => m.user_id) || []);

      // Filter out users who are already members
      const pending = allProfiles?.filter(p => !memberUserIds.has(p.id)) || [];

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

  return {
    pendingUsers,
    isLoading,
    pendingCount: pendingUsers.length,
    addUserToWorkspace,
  };
};
