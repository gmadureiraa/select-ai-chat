import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

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
  const { workspace: contextWorkspace, isLoading: isLoadingContext } = useWorkspaceContext();

  // Fetch user's role in the SPECIFIC workspace from context (URL-based)
  const { data: memberData, isLoading: isLoadingMember, isFetched } = useQuery({
    queryKey: ["workspace-member-role", contextWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !contextWorkspace?.id) return null;
      
      const { data, error } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", contextWorkspace.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching workspace member role:", error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id && !!contextWorkspace?.id && !authLoading,
  });

  // Consider loading if auth is loading OR context is loading OR member query hasn't fetched yet
  const isLoading = authLoading || isLoadingContext || (!!user?.id && !!contextWorkspace?.id && !isFetched);

  // Build workspace object with userRole from the specific workspace
  const workspace = contextWorkspace ? {
    id: contextWorkspace.id,
    name: contextWorkspace.name,
    slug: contextWorkspace.slug,
    owner_id: contextWorkspace.owner_id,
    created_at: contextWorkspace.created_at,
    userRole: memberData?.role as WorkspaceRole | undefined,
  } : null;

  const userRole = memberData?.role as WorkspaceRole | undefined;
  const isViewer = userRole === "viewer";
  const isMember = userRole === "member";
  const isAdminOrOwner = userRole === "owner" || userRole === "admin";
  const canDelete = isAdminOrOwner;
  const canManageTeam = isAdminOrOwner;
  const canEdit = userRole !== "viewer" && userRole !== undefined;
  const canCreate = userRole !== "viewer" && userRole !== undefined;
  const isOwner = userRole === "owner";
  
  // Permission helpers for UI visibility
  const canViewTools = isAdminOrOwner;
  const canViewKnowledgeBase = !isViewer && userRole !== undefined;
  const canViewPerformance = userRole !== undefined;
  const canViewLibrary = !isViewer && userRole !== undefined;
  const canViewActivities = isAdminOrOwner;
  const canViewClients = isAdminOrOwner;

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
