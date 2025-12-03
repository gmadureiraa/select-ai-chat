import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  profile?: {
    email: string | null;
    full_name: string | null;
  };
}

export const useWorkspace = () => {
  const { user } = useAuth();

  const { data: workspace, isLoading: isLoadingWorkspace } = useQuery({
    queryKey: ["workspace", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          workspace_id,
          role,
          workspaces:workspace_id (
            id,
            name,
            owner_id,
            created_at
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching workspace:", error);
        return null;
      }

      return {
        ...(data.workspaces as unknown as Workspace),
        userRole: data.role as WorkspaceRole,
      };
    },
    enabled: !!user?.id,
  });

  const canDelete = workspace?.userRole === "owner" || workspace?.userRole === "admin";
  const canManageTeam = workspace?.userRole === "owner" || workspace?.userRole === "admin";
  const isOwner = workspace?.userRole === "owner";

  return {
    workspace,
    isLoadingWorkspace,
    userRole: workspace?.userRole as WorkspaceRole | undefined,
    canDelete,
    canManageTeam,
    isOwner,
  };
};
