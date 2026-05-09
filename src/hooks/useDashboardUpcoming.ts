// useDashboardUpcoming — próximos N posts agendados (status=scheduled/approved)
// nos próximos 14 dias, ordenados por data crescente.
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export interface UpcomingPost {
  id: string;
  title: string | null;
  status: string;
  scheduledAt: string | null;
  platform: string | null;
  clientId: string | null;
  contentType: string | null;
}

export function useDashboardUpcoming(limit: number = 5) {
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;

  return useQuery<UpcomingPost[]>({
    queryKey: ["dashboard-upcoming-posts", workspaceId, limit],
    queryFn: async () => {
      if (!workspaceId) return [];
      const now = new Date();
      const horizon = addDays(now, 14);

      const { data, error } = await supabase
        .from("planning_items")
        .select("id, title, status, scheduled_at, platform, client_id, content_type")
        .eq("workspace_id", workspaceId)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", horizon.toISOString())
        .in("status", ["scheduled", "approved", "review", "draft"])
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: String(r.id),
        title: (r.title as string | null) ?? null,
        status: String(r.status),
        scheduledAt: (r.scheduled_at as string | null) ?? null,
        platform: (r.platform as string | null) ?? null,
        clientId: (r.client_id as string | null) ?? null,
        contentType: (r.content_type as string | null) ?? null,
      }));
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
