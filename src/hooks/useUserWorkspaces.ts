import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserWorkspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: "owner" | "admin" | "member" | "viewer";
}

export const useUserWorkspaces = () => {
  const { user } = useAuth();

  const { data: workspaces, isLoading, refetch } = useQuery({
    queryKey: ["user-workspaces", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch workspaces where user is a member
      const { data: memberships, error } = await supabase
        .from("workspace_members")
        .select(`
          role,
          workspaces (
            id,
            name,
            slug,
            logo_url
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user workspaces:", error);
        return [];
      }

      // Transform the data
      const userWorkspaces: UserWorkspace[] = memberships
        ?.filter(m => m.workspaces)
        .map(m => {
          const ws = m.workspaces as unknown as {
            id: string;
            name: string;
            slug: string;
            logo_url: string | null;
          };
          return {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            logo_url: ws.logo_url,
            role: m.role as UserWorkspace["role"],
          };
        }) || [];

      return userWorkspaces;
    },
    enabled: !!user?.id,
  });

  return {
    workspaces: workspaces || [],
    isLoading,
    hasMultipleWorkspaces: (workspaces?.length || 0) > 1,
    refetch,
  };
};
