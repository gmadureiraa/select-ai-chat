// 2026-05-21 — Lê a série histórica real de zernio_daily_snapshots via o
// handler `historical-snapshots`, alimentado pelo cron diário cron-snapshot-zernio.
// Substitui o stub vazio que existia desde a remoção do Metricool (18/05).
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
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
    queryKey: ['historical-snapshots', clientId, network, period],
    queryFn: async (): Promise<SnapshotResponse> => {
      const { data, error } = await apiInvoke<SnapshotResponse>('historical-snapshots', {
        body: { clientId, network, period },
      });
      if (error || !data) {
        const now = new Date();
        const fromDate = new Date(now.getTime() - period * 86400_000);
        return {
          ok: true as const,
          snapshots: [],
          source: 'api' as const,
          range: { from: localDateKey(fromDate), to: localDateKey(now), days: period },
          coverage: { snapshotDays: 0, totalDays: period, ratio: 0 },
        };
      }
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  });
}
