// useDashboardClientCards — pra cada cliente acessível, traz os dados
// necessários pro Performance Snapshot card:
//
//   - Total followers cross-network (snapshot mais recente)
//   - Sparkline de followers (Instagram primário) últimos 7 dias
//   - Posts publicados últimos 7d (metricool_posts)
//   - Eng% médio últimos 7d
//   - Trend vs 7 dias anteriores
//
// Roda 1 query agregada de snapshots + 1 de posts pra todos clientes de uma vez,
// depois fan-out client-side. Mais barato que N queries paralelas.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export interface ClientCardData {
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  totalFollowers: number;
  followersSparkline: Array<{ date: string; value: number }>;
  postsLast7d: number;
  postsPrev7d: number;
  avgEngagementLast7d: number;
  avgEngagementPrev7d: number;
  hasData: boolean;
}

export function useDashboardClientCards() {
  const { workspace } = useWorkspaceContext();
  const { clients } = useClients();
  const workspaceId = workspace?.id;
  const clientIds = useMemo(
    () => (clients ?? []).map((c) => c.id),
    [clients],
  );
  const clientIdsKey = clientIds.join(",");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-client-cards", workspaceId, clientIdsKey],
    queryFn: async () => {
      if (clientIds.length === 0) return null;

      const now = new Date();
      const sevenDaysAgo = addDays(now, -7);
      const fourteenDaysAgo = addDays(now, -14);
      const fourteenDaysAgoIso = fourteenDaysAgo.toISOString();
      const fourteenDaysAgoDate = fourteenDaysAgo.toISOString().slice(0, 10);

      // ── 1) Snapshots últimos 14 dias (todos clientes, todas redes) ──
      const { data: snapshots } = await (supabase as any)
        .from("metricool_daily_snapshots")
        .select("client_id, network, snapshot_date, followers")
        .in("client_id", clientIds)
        .gte("snapshot_date", fourteenDaysAgoDate)
        .order("snapshot_date", { ascending: true })
        .limit(5000);

      // ── 2) Posts últimos 14 dias (todos clientes) ──
      const { data: posts } = await (supabase as any)
        .from("metricool_posts")
        .select(
          "client_id, network, published_at, likes, comments, shares, reach, impressions, views, engagement_rate",
        )
        .in("client_id", clientIds)
        .gte("published_at", fourteenDaysAgoIso)
        .order("published_at", { ascending: false })
        .limit(5000);

      return {
        snapshots: (snapshots ?? []) as Array<{
          client_id: string;
          network: string;
          snapshot_date: string;
          followers: number | null;
        }>,
        posts: (posts ?? []) as Array<{
          client_id: string;
          network: string;
          published_at: string | null;
          likes: number | null;
          comments: number | null;
          shares: number | null;
          reach: number | null;
          impressions: number | null;
          views: number | null;
          engagement_rate: number | null;
        }>,
      };
    },
    enabled: !!workspaceId && clientIds.length > 0,
    staleTime: 60_000,
  });

  const cards = useMemo<ClientCardData[]>(() => {
    if (!clients || clients.length === 0) return [];
    if (!data) {
      return clients.map((c) => ({
        clientId: c.id,
        clientName: c.name,
        clientAvatar: c.avatar_url,
        totalFollowers: 0,
        followersSparkline: [],
        postsLast7d: 0,
        postsPrev7d: 0,
        avgEngagementLast7d: 0,
        avgEngagementPrev7d: 0,
        hasData: false,
      }));
    }

    const now = new Date();
    const sevenDaysAgo = addDays(now, -7);

    // Index snapshots: clientId → network → date → row
    const snapshotsByClient: Record<
      string,
      Record<string, Array<{ date: string; followers: number }>>
    > = {};
    for (const s of data.snapshots) {
      const cid = s.client_id as string;
      const net = (s.network as string) || "instagram";
      if (!snapshotsByClient[cid]) snapshotsByClient[cid] = {};
      if (!snapshotsByClient[cid][net]) snapshotsByClient[cid][net] = [];
      snapshotsByClient[cid][net].push({
        date: String(s.snapshot_date),
        followers: Number(s.followers || 0),
      });
    }

    // Index posts: clientId → list (already sorted desc by published_at)
    const postsByClient: Record<string, typeof data.posts> = {};
    for (const p of data.posts) {
      const cid = p.client_id as string;
      if (!postsByClient[cid]) postsByClient[cid] = [];
      postsByClient[cid].push(p);
    }

    return clients.map((c) => {
      const cid = c.id;
      const clientSnapshots = snapshotsByClient[cid] || {};
      const clientPosts = postsByClient[cid] || [];

      // Total followers: para cada rede, pegar o último snapshot do range
      let totalFollowers = 0;
      let hasFollowers = false;
      for (const net of Object.keys(clientSnapshots)) {
        const series = clientSnapshots[net];
        if (series.length === 0) continue;
        const sortedDesc = [...series].sort((a, b) =>
          b.date.localeCompare(a.date),
        );
        totalFollowers += sortedDesc[0].followers;
        hasFollowers = true;
      }

      // Sparkline: instagram primeiro, fallback pro maior canal
      let sparkSource: Array<{ date: string; value: number }> = [];
      const igSeries = clientSnapshots.instagram;
      if (igSeries && igSeries.length > 0) {
        sparkSource = igSeries
          .filter((s) => new Date(s.date) >= sevenDaysAgo)
          .map((s) => ({ date: s.date, value: s.followers }));
      } else {
        // Pega o canal com mais followers do dia mais recente
        const candidates = Object.entries(clientSnapshots).map(
          ([net, series]) => ({
            net,
            series: series
              .filter((s) => new Date(s.date) >= sevenDaysAgo)
              .map((s) => ({ date: s.date, value: s.followers })),
            latest: [...series].sort((a, b) => b.date.localeCompare(a.date))[0]
              ?.followers ?? 0,
          }),
        );
        candidates.sort((a, b) => b.latest - a.latest);
        sparkSource = candidates[0]?.series ?? [];
      }

      // Posts e engagement: dividir entre [now-7d, now] e [now-14d, now-7d]
      const last7Posts = clientPosts.filter(
        (p) => p.published_at && new Date(p.published_at) >= sevenDaysAgo,
      );
      const prev7Posts = clientPosts.filter((p) => {
        if (!p.published_at) return false;
        const d = new Date(p.published_at);
        return d < sevenDaysAgo;
      });

      const computeAvgEngagement = (
        list: typeof data.posts,
      ): number => {
        if (list.length === 0) return 0;
        // Se tem engagement_rate gravado, usa direto. Senão calcula bruto.
        let totalEng = 0;
        let totalDenom = 0;
        let likes = 0;
        let comments = 0;
        let shares = 0;
        for (const p of list) {
          const denom = Math.max(
            Number(p.reach || 0),
            Number(p.impressions || 0),
            Number(p.views || 0),
          );
          if (denom > 0) {
            totalDenom += denom;
            likes += Number(p.likes || 0);
            comments += Number(p.comments || 0);
            shares += Number(p.shares || 0);
          }
        }
        totalEng = likes + comments + shares;
        if (totalDenom === 0) return 0;
        return (totalEng / totalDenom) * 100;
      };

      return {
        clientId: cid,
        clientName: c.name,
        clientAvatar: c.avatar_url,
        totalFollowers,
        followersSparkline: sparkSource,
        postsLast7d: last7Posts.length,
        postsPrev7d: prev7Posts.length,
        avgEngagementLast7d: computeAvgEngagement(last7Posts),
        avgEngagementPrev7d: computeAvgEngagement(prev7Posts),
        hasData: hasFollowers || clientPosts.length > 0,
      };
    });
  }, [clients, data]);

  return { cards, isLoading, error };
}
