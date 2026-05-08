// useViralStats — agregados de uso viral (carrosséis, reels, briefs, tokens, planning)
// pra Home dashboard e Client Analytics.
//
// Fonte: handler /api/viral-stats (Fase H).
// Workspace é resolvido via useWorkspace (compartilhado em todo app).
// Quando passa client_id, todas as contagens (exceto tokens) são scoped ao cliente.

import { useQuery } from "@tanstack/react-query";
import { apiInvoke } from "@/lib/apiInvoke";
import { useWorkspace } from "@/hooks/useWorkspace";

export type ViralStatsRange = "7d" | "30d" | "90d";

export interface ViralStatsData {
  range: ViralStatsRange;
  days: number;
  carousels: {
    total: number;
    published: number;
    draft: number;
    this_period: number;
  };
  reels: {
    total: number;
    this_period: number;
  };
  briefs: {
    total: number;
    this_period: number;
  };
  tokens: {
    quota: number;
    used: number;
    remaining: number;
    balance: number;
  };
  planning: {
    ideas: number;
    drafts: number;
    scheduled: number;
    published_total: number;
    published_this_period: number;
  };
}

export function useViralStats(opts: {
  clientId?: string | null;
  range?: ViralStatsRange;
} = {}) {
  const { workspace } = useWorkspace();
  const range = opts.range || "30d";

  return useQuery<ViralStatsData>({
    queryKey: ["viral-stats", workspace?.id, opts.clientId ?? null, range],
    enabled: !!workspace?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await apiInvoke("viral-stats", {
        body: {
          workspace_id: workspace!.id,
          client_id: opts.clientId ?? null,
          range,
        },
      });
      if (error) throw new Error(error.message || "Falha ao carregar stats");
      return data as ViralStatsData;
    },
  });
}
