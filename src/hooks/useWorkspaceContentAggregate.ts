import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface WorkspaceClientAggregate {
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  items_count: number;
  total_engagement: number;
  avg_engagement: number;
  last_item_at: string | null;
  carousel_count: number;
  reel_count: number;
  thread_count: number;
}

/**
 * Lê a view `workspace_content_aggregate` (migration 0019) — soma engagement
 * por cliente do workspace pra dashboard cross-client. View tem grant SELECT
 * pra authenticated, então PostgREST devolve direto.
 */
export function useWorkspaceContentAggregate() {
  const { workspace } = useWorkspace();
  return useQuery<WorkspaceClientAggregate[]>({
    queryKey: ["workspace-content-aggregate", workspace?.id],
    enabled: !!workspace?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspace_content_aggregate")
        .select("*")
        .eq("workspace_id", workspace!.id)
        .order("total_engagement", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        client_id: r.client_id,
        client_name: r.client_name,
        client_avatar: r.client_avatar,
        items_count: Number(r.items_count) || 0,
        total_engagement: Number(r.total_engagement) || 0,
        avg_engagement: Number(r.avg_engagement) || 0,
        last_item_at: r.last_item_at,
        carousel_count: Number(r.carousel_count) || 0,
        reel_count: Number(r.reel_count) || 0,
        thread_count: Number(r.thread_count) || 0,
      })) as WorkspaceClientAggregate[];
    },
  });
}
