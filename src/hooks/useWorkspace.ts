import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
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
  const { user, loading: authLoading } = useAuth();

  const { data: workspace, isLoading: isLoadingWorkspace, isFetched } = useQuery({
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
            slug,
            owner_id,
            created_at
          )
        `)
        .eq("user_id", user.id)
        .maybeSingle(); // Use maybeSingle to return null instead of error when no row

      if (error) {
        console.error("Error fetching workspace:", error);
        return null;
      }

      if (!data) {
        return null; // User is not in any workspace
      }

      return {
        ...(data.workspaces as unknown as Workspace),
        userRole: data.role as WorkspaceRole,
      };
    },
    enabled: !!user?.id && !authLoading,
  });

  // Consider loading if auth is loading OR workspace query hasn't fetched yet
  const isLoading = authLoading || (!!user?.id && !isFetched);

  const userRole = workspace?.userRole as WorkspaceRole | undefined;
  const isViewer = userRole === "viewer";
  const isMember = userRole === "member";
  const isAdminOrOwner = userRole === "owner" || userRole === "admin";
  const canDelete = isAdminOrOwner;
  const canManageTeam = isAdminOrOwner;
  const canEdit = userRole !== "viewer";
  const canCreate = userRole !== "viewer";
  const isOwner = userRole === "owner";
  
  // Permission helpers for UI visibility
  const canViewTools = isAdminOrOwner; // Only admin/owner see full tools
  const canViewKnowledgeBase = !isViewer; // Member and above see knowledge base
  const canViewPerformance = true; // Everyone sees performance
  const canViewLibrary = !isViewer; // Member and above
  const canViewActivities = isAdminOrOwner; // Only admin/owner
  const canViewClients = isAdminOrOwner; // Only admin/owner see clients management

  return {
    workspace,
    isLoadingWorkspace: isLoading,
    userRole,
    isViewer,
    isMember,
    isAdminOrOwner,
    canDelete,
    canManageTeam,
    canEdit,
    canCreate,
    isOwner,
    canViewTools,
    canViewKnowledgeBase,
    canViewPerformance,
    canViewLibrary,
    canViewActivities,
    canViewClients,
  };
};
