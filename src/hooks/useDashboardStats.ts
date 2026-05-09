// useDashboardStats — métricas agregadas do workspace pra hero do Dashboard.
//
// Conta clientes acessíveis, items de planning, posts publicados nos últimos
// 30 dias (planning_items + metricool_posts), e total de followers cross-network
// no snapshot mais recente.
//
// Roda em queries paralelas leves; staleTime 60s. Não puxa rows pesadas — só
// counts e SUMs (header=exact ou agregados curtos).
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useClients } from "@/hooks/useClients";

export interface DashboardStats {
  totalClients: number;
  activeClients30d: number;
  totalPlanningItems: number;
  itemsScheduledNext7d: number;
  itemsPublishedLast30d: number;
  metricoolPostsLast30d: number;
  totalFollowersLatest: number | null;
}

export function useDashboardStats() {
  const { workspace } = useWorkspaceContext();
  const { clients } = useClients();
  const workspaceId = workspace?.id;

  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", workspaceId, clients?.length],
    queryFn: async () => {
      if (!workspaceId) {
        return {
          totalClients: 0,
          activeClients30d: 0,
          totalPlanningItems: 0,
          itemsScheduledNext7d: 0,
          itemsPublishedLast30d: 0,
          metricoolPostsLast30d: 0,
          totalFollowersLatest: null,
        };
      }

      const now = new Date();
      const sevenDays = addDays(now, 7).toISOString();
      const thirtyDaysAgo = addDays(now, -30).toISOString();
      const clientIds = (clients ?? []).map((c) => c.id);

      const [
        planningTotal,
        scheduledNext7,
        publishedLast30,
        activeClientsRows,
        metricoolPostsCount,
      ] = await Promise.all([
        supabase
          .from("planning_items")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
        supabase
          .from("planning_items")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", sevenDays)
          .in("status", ["scheduled", "approved", "review", "draft"]),
        supabase
          .from("planning_items")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "published")
          .gte("updated_at", thirtyDaysAgo),
        supabase
          .from("planning_items")
          .select("client_id")
          .eq("workspace_id", workspaceId)
          .gte("updated_at", thirtyDaysAgo)
          .not("client_id", "is", null)
          .limit(2000),
        clientIds.length > 0
          ? (supabase as any)
              .from("metricool_posts")
              .select("id", { count: "exact", head: true })
              .in("client_id", clientIds)
              .gte("published_at", thirtyDaysAgo)
          : Promise.resolve({ count: 0 } as { count: number }),
      ]);

      const activeIds = new Set(
        (activeClientsRows.data ?? []).map((r) => r.client_id),
      );

      // Last followers: pega o snapshot mais recente por (client, network)
      // dos últimos 7 dias e soma. Faz num único request agrupado client-side.
      let totalFollowersLatest: number | null = null;
      if (clientIds.length > 0) {
        const { data: snapshotRows } = await (supabase as any)
          .from("metricool_daily_snapshots")
          .select("client_id, network, snapshot_date, followers")
          .in("client_id", clientIds)
          .gte("snapshot_date", addDays(now, -7).toISOString().slice(0, 10))
          .order("snapshot_date", { ascending: false })
          .limit(2000);
        if (snapshotRows && snapshotRows.length > 0) {
          // Pega o mais recente por (client_id, network)
          const seen = new Set<string>();
          let total = 0;
          for (const r of snapshotRows as Array<{
            client_id: string;
            network: string;
            followers: number | null;
          }>) {
            const key = `${r.client_id}::${r.network}`;
            if (seen.has(key)) continue;
            seen.add(key);
            total += Number(r.followers || 0);
          }
          totalFollowersLatest = total;
        }
      }

      return {
        totalClients: clients?.length ?? 0,
        activeClients30d: activeIds.size,
        totalPlanningItems: planningTotal.count ?? 0,
        itemsScheduledNext7d: scheduledNext7.count ?? 0,
        itemsPublishedLast30d: publishedLast30.count ?? 0,
        metricoolPostsLast30d: metricoolPostsCount.count ?? 0,
        totalFollowersLatest,
      };
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
