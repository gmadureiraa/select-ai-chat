import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

export const WorkspaceRedirect = () => {
  const { user, loading: authLoading } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasWorkspace, setHasWorkspace] = useState(true);

  useEffect(() => {
    const fetchUserWorkspace = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // First check for pending invites using RPC (bypasses RLS)
        const { data: pendingInvites } = await supabase.rpc("get_my_pending_workspace_invites");

        if (pendingInvites && pendingInvites.length > 0) {
          const invite = pendingInvites[0];
          
          // Accept the invite via RPC
          await supabase.rpc("accept_pending_invite", {
            p_workspace_id: invite.workspace_id,
            p_user_id: user.id
          });
          
          // Redirect to the workspace
          setSlug(invite.workspace_slug);
          setIsLoading(false);
          return;
        }

        // Get user's workspace slug using the database function
        const { data, error } = await supabase
          .rpc("get_user_workspace_slug", { p_user_id: user.id });

        if (error || !data) {
          // User has no workspace
          setHasWorkspace(false);
        } else {
          setSlug(data);
        }
      } catch (err) {
        console.error("Error fetching workspace:", err);
        setHasWorkspace(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchUserWorkspace();
    }
  }, [user, authLoading]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Has workspace - redirect to it
  if (slug) {
    return <Navigate to={`/${slug}`} replace />;
  }

  // No workspace - redirect to no-workspace page
  if (!hasWorkspace) {
    return <Navigate to="/no-workspace" replace />;
  }

  return null;
};

export default WorkspaceRedirect;
