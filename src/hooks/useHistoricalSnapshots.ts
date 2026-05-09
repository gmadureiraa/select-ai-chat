// useHistoricalSnapshots — série temporal diária de métricas de uma rede
// vinda da nossa tabela `metricool_daily_snapshots` (cron 06:00 UTC).
//
// Override Metricool API (que só dá 30-90d de janela). A partir do dia em que
// o cron foi ligado, vai acumulando histórico ad eternum.
//
// Quando snapshots cobrem o range completo: source = 'snapshots'
// Quando snapshots cobrem parcialmente: handler complementa com Metricool
// API e retorna source = 'mixed' | 'api'.
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import type { MetricoolNetwork } from '@/hooks/useMetricoolPerformance';

export interface SnapshotData {
  date: string; // YYYY-MM-DD
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
    queryKey: ['metricool-snapshots', clientId, network, period],
    queryFn: async (): Promise<SnapshotResponse> => {
      const now = new Date();
      const fromDate = new Date(now.getTime() - period * 86400_000);
      const { data, error } = await apiInvoke('metricool-snapshots', {
        body: {
          clientId,
          network,
          fromDate: localDateKey(fromDate),
          toDate: localDateKey(now),
        },
      });
      if (error) throw error;
      return data as SnapshotResponse;
    },
    enabled: !!clientId && !!network,
    staleTime: 1000 * 60 * 30, // 30min — snapshots só mudam 1x/dia
  });
}
