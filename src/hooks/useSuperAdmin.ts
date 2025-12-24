import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WorkspaceOverview {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  owner_email: string | null;
  created_at: string;
  members_count: number;
  clients_count: number;
}

export interface WorkspaceDetails {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string | null;
  owner_email: string | null;
  plan_name: string | null;
  plan_status: string | null;
  tokens_balance: number | null;
  tokens_used: number | null;
  current_period_end: string | null;
}

export interface WorkspaceMember {
  member_id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  joined_at: string;
}

export interface WorkspaceClient {
  client_id: string;
  client_name: string;
  description: string | null;
  created_at: string;
}

export interface MemberTokenUsage {
  user_id: string;
  email: string | null;
  full_name: string | null;
  tokens_used: number;
}

export const useSuperAdmin = () => {
  const { user, loading: authLoading } = useAuth();

  // Check if user is super-admin
  const { data: isSuperAdmin, isLoading: isCheckingAdmin } = useQuery({
    queryKey: ["super-admin-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from("super_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking super-admin status:", error);
        return false;
      }

      return !!data;
    },
    enabled: !!user?.id && !authLoading,
  });

  // Get all workspaces (only works if super-admin)
  const { data: workspaces, isLoading: isLoadingWorkspaces, refetch: refetchWorkspaces } = useQuery({
    queryKey: ["admin-all-workspaces", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_workspaces_admin");

      if (error) {
        console.error("Error fetching admin workspaces:", error);
        return [];
      }

      return (data || []) as WorkspaceOverview[];
    },
    enabled: !!isSuperAdmin,
  });

  return {
    isSuperAdmin: isSuperAdmin || false,
    isLoading: authLoading || isCheckingAdmin,
    workspaces: workspaces || [],
    isLoadingWorkspaces,
    refetchWorkspaces,
  };
};

// Separate hook for workspace details with React Query
export const useWorkspaceDetailsAdmin = (workspaceId: string | null) => {
  const { data: isSuperAdmin } = useQuery({
    queryKey: ["super-admin-check"],
    enabled: false, // This query is already running in useSuperAdmin
  });

  const { data: details, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["admin-workspace-details", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      
      const { data, error } = await supabase.rpc("get_workspace_details_admin", {
        p_workspace_id: workspaceId,
      });

      if (error) {
        console.error("Error fetching workspace details:", error);
        return null;
      }

      return (data?.[0] as WorkspaceDetails) || null;
    },
    enabled: !!workspaceId,
    staleTime: 30000, // Cache for 30 seconds
  });

  const { data: members, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["admin-workspace-members", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase.rpc("get_workspace_members_admin", {
        p_workspace_id: workspaceId,
      });

      if (error) {
        console.error("Error fetching workspace members:", error);
        return [];
      }

      return (data || []) as WorkspaceMember[];
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });

  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["admin-workspace-clients", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase.rpc("get_workspace_clients_admin", {
        p_workspace_id: workspaceId,
      });

      if (error) {
        console.error("Error fetching workspace clients:", error);
        return [];
      }

      return (data || []) as WorkspaceClient[];
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });

  const { data: memberTokens, isLoading: isLoadingTokens } = useQuery({
    queryKey: ["admin-workspace-member-tokens", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase.rpc("get_workspace_member_tokens_admin", {
        p_workspace_id: workspaceId,
      });

      if (error) {
        console.error("Error fetching member tokens:", error);
        return [];
      }

      return (data || []) as MemberTokenUsage[];
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });

  return {
    details,
    members,
    clients,
    memberTokens,
    isLoading: isLoadingDetails || isLoadingMembers || isLoadingClients || isLoadingTokens,
  };
};
