import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

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

  const userRole = workspace?.userRole as WorkspaceRole | undefined;
  const isViewer = userRole === "viewer";
  const canDelete = userRole === "owner" || userRole === "admin";
  const canManageTeam = userRole === "owner" || userRole === "admin";
  const canEdit = userRole !== "viewer";
  const canCreate = userRole !== "viewer";
  const isOwner = userRole === "owner";

  return {
    workspace,
    isLoadingWorkspace,
    userRole,
    isViewer,
    canDelete,
    canManageTeam,
    canEdit,
    canCreate,
    isOwner,
  };
};
