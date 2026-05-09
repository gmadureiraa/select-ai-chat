// useDashboardTopPosts — top performers cross-cliente nos últimos 30 dias.
// Usa metricool_posts (já backfilled diariamente) e ordena por likes+comments
// com desempate em reach. Inclui contexto do cliente pra UI.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export interface TopPostRow {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  network: string;
  postId: string;
  postType: string | null;
  url: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  views: number;
  engagement: number;
}

export function useDashboardTopPosts(limit: number = 6) {
  const { workspace } = useWorkspaceContext();
  const { clients } = useClients();
  const workspaceId = workspace?.id;
  const clientIds = useMemo(
    () => (clients ?? []).map((c) => c.id),
    [clients],
  );

  return useQuery<TopPostRow[]>({
    queryKey: ["dashboard-top-posts", workspaceId, clientIds.join(","), limit],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const since = addDays(new Date(), -30).toISOString();

      const { data, error } = await (supabase as any)
        .from("metricool_posts")
        .select(
          "id, client_id, network, post_id, post_type, url, caption, thumbnail_url, published_at, likes, comments, shares, reach, views, video_views, impressions",
        )
        .in("client_id", clientIds)
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const clientMap = new Map(
        (clients ?? []).map((c) => [c.id, { name: c.name, avatar: c.avatar_url }]),
      );

      const rows = ((data ?? []) as Array<any>).map((p) => {
        const likes = Number(p.likes || 0);
        const comments = Number(p.comments || 0);
        const shares = Number(p.shares || 0);
        const eng = likes + comments + shares;
        const c = clientMap.get(p.client_id as string);
        return {
          id: String(p.id),
          clientId: String(p.client_id),
          clientName: c?.name ?? "—",
          clientAvatar: c?.avatar ?? null,
          network: String(p.network),
          postId: String(p.post_id),
          postType: (p.post_type as string | null) ?? null,
          url: (p.url as string | null) ?? null,
          caption: (p.caption as string | null) ?? null,
          thumbnailUrl: (p.thumbnail_url as string | null) ?? null,
          publishedAt: (p.published_at as string | null) ?? null,
          likes,
          comments,
          shares,
          reach: Number(p.reach || 0),
          views: Number(p.views || p.video_views || p.impressions || 0),
          engagement: eng,
        } satisfies TopPostRow;
      });

      rows.sort((a, b) => {
        if (b.engagement !== a.engagement) return b.engagement - a.engagement;
        return (b.reach || b.views) - (a.reach || a.views);
      });

      return rows.slice(0, limit);
    },
    enabled: !!workspaceId && clientIds.length > 0,
    staleTime: 60_000,
  });
}
