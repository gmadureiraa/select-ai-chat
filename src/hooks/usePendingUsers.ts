import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceRole } from "@/hooks/useWorkspace";

export interface PendingUser {
  id: string;
  request_id: string;
  email: string | null;
  full_name: string | null;
  requested_at: string;
  message?: string | null;
}

export interface RejectedUser {
  id: string;
  user_id: string;
  rejected_at: string;
  reason: string | null;
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

export const usePendingUsers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const { user } = useAuth();

  // Fetch pending access requests for current workspace
  const { data: pendingUsers = [], isLoading } = useQuery({
    queryKey: ["pending-users", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      // Get pending access requests for this workspace
      const { data: requests, error: requestsError } = await supabase
        .from("workspace_access_requests")
        .select("id, user_id, requested_at, message")
        .eq("workspace_id", workspace.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (requestsError) throw requestsError;
      if (!requests || requests.length === 0) return [];

      // Get profile info for requesting users
      const userIds = requests.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return requests.map(r => ({
        id: r.user_id,
        request_id: r.id,
        email: profileMap.get(r.user_id)?.email || null,
        full_name: profileMap.get(r.user_id)?.full_name || null,
        requested_at: r.requested_at,
        message: r.message,
      })) as PendingUser[];
    },
    enabled: !!workspace?.id,
  });

  // Add a pending user to the workspace (approve request)
  const addUserToWorkspace = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: WorkspaceRole }) => {
      if (!workspace?.id || !user?.id) throw new Error("No workspace");

      // Add to workspace members
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

      // Update request status to approved
      await supabase
        .from("workspace_access_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
        })
        .eq("workspace_id", workspace.id)
        .eq("user_id", userId);

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

  // Reject a pending user
  const rejectUser = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      if (!workspace?.id || !user?.id) throw new Error("No workspace or user");

      // Update request status to rejected
      const { data, error } = await supabase
        .from("workspace_access_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
        })
        .eq("workspace_id", workspace.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      // Also add to rejected users table if it exists (backwards compat)
      await supabase
        .from("workspace_rejected_users")
        .upsert({
          workspace_id: workspace.id,
          user_id: userId,
          rejected_by: user.id,
          reason,
        }, { onConflict: "workspace_id,user_id" })
        .select();

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users", workspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["rejected-users", workspace?.id] });
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

  // Unreject a user (allow them to request again)
  const unrejectUser = useMutation({
    mutationFn: async (userId: string) => {
      if (!workspace?.id) throw new Error("No workspace");

      // Remove from rejected users table
      await supabase
        .from("workspace_rejected_users")
        .delete()
        .eq("workspace_id", workspace.id)
        .eq("user_id", userId);

      // Delete the rejected request so they can request again
      const { error } = await supabase
        .from("workspace_access_requests")
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
        description: "O usuário pode solicitar acesso novamente.",
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

      // Get rejected requests
      const { data: requests, error: requestsError } = await supabase
        .from("workspace_access_requests")
        .select("id, user_id, processed_at")
        .eq("workspace_id", workspace.id)
        .eq("status", "rejected")
        .order("processed_at", { ascending: false });

      if (requestsError) throw requestsError;
      if (!requests || requests.length === 0) return [];

      // Get profile info
      const userIds = requests.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get rejection reasons from workspace_rejected_users
      const { data: rejectionReasons } = await supabase
        .from("workspace_rejected_users")
        .select("user_id, reason")
        .eq("workspace_id", workspace.id)
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const reasonMap = new Map(rejectionReasons?.map(r => [r.user_id, r.reason]) || []);

      return requests.map(r => ({
        id: r.id,
        user_id: r.user_id,
        rejected_at: r.processed_at || "",
        reason: reasonMap.get(r.user_id) || null,
        profile: profileMap.get(r.user_id) || null,
      })) as RejectedUser[];
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
