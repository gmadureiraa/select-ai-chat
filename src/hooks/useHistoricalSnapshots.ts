// 2026-05-18 rev2 — STUB. metricool-snapshots handler removido junto com Metricool.
// Histórico vai ser reconstruído via late-analytics quando Wave A entregar.
// Por enquanto, queryFn retorna snapshots vazios pra não quebrar componentes
// que ainda importam (5 dashboards). Os componentes mostram "sem histórico" naturalmente.
import { useQuery } from '@tanstack/react-query';
import type { MetricoolNetwork } from '@/hooks/useMetricoolPerformance';

export interface SnapshotData {
  date: string;
  followers: number | null;
  posts_count: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reach: number;
  total_impressions: number;
  total_views: number;
  total_saves: number;
  avg_engagement_rate: number;
  source: 'snapshot' | 'api';
}

export interface SnapshotResponse {
  ok: true;
  snapshots: SnapshotData[];
  source: 'snapshots' | 'mixed' | 'api';
  range: { from: string; to: string; days: number };
  coverage: { snapshotDays: number; totalDays: number; ratio: number };
}

function localDateKey(d: Date, tz = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

export function useHistoricalSnapshots(
  clientId: string,
  network: MetricoolNetwork,
  period: number = 30,
) {
  return useQuery({
    queryKey: ['historical-snapshots-stub', clientId, network, period],
    queryFn: async (): Promise<SnapshotResponse> => {
      const now = new Date();
      const fromDate = new Date(now.getTime() - period * 86400_000);
      return {
        ok: true as const,
        snapshots: [],
        source: 'api' as const,
        range: {
          from: localDateKey(fromDate),
          to: localDateKey(now),
          days: period,
        },
        coverage: { snapshotDays: 0, totalDays: period, ratio: 0 },
      };
    },
    enabled: false, // disabled até Late equivalent entrar (Wave A)
    staleTime: Infinity,
  });
}
