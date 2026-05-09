// Metricool Reports — Performance Dashboards + histórico de relatórios PDF.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export interface MetricoolPerformanceDashboard {
  id: number | string;
  title?: string;
  description?: string;
  from?: string | { dateTime?: string; timezone?: string };
  to?: string | { dateTime?: string; timezone?: string };
  networks?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface MetricoolReportHistoryItem {
  creationDate?: string;
  from?: string;
  to?: string;
  reportType?: string;
  reportFile?: string;
  status?: 'PENDING' | 'RUNNING' | 'RETRYING' | 'FINISHED' | 'FAILED';
  jobId?: string;
  brandSummary?: boolean;
  instagram?: boolean;
  facebook?: boolean;
  twitter?: boolean;
  linkedin?: boolean;
  tiktok?: boolean;
  threads?: boolean;
  bluesky?: boolean;
  pinterest?: boolean;
  youtube?: boolean;
  [key: string]: unknown;
}

export interface MetricoolReportsListResult {
  dashboards: MetricoolPerformanceDashboard[];
  history: MetricoolReportHistoryItem[];
}

export interface GenerateDashboardVars {
  title: string;
  description: string;
  from: string; // ISO YYYY-MM-DDTHH:mm:ss
  to: string;
  networks: string[];
  timezone?: string;
  autoCategorize?: boolean;
}

const FIVE_MIN = 1000 * 60 * 5;

export function useMetricoolReports(clientId: string) {
  // Auto-refresh moderado quando há reports em PENDING/RUNNING.
  return useQuery({
    queryKey: ['metricool-reports', clientId, 'list'],
    queryFn: async (): Promise<MetricoolReportsListResult> => {
      const { data, error } = await apiInvoke('metricool-reports', {
        body: { clientId, mode: 'list' },
      });
      if (error) throw error;
      return {
        dashboards: ((data as any)?.dashboards || []) as MetricoolPerformanceDashboard[],
        history: ((data as any)?.history || []) as MetricoolReportHistoryItem[],
      };
    },
    enabled: !!clientId,
    staleTime: FIVE_MIN,
    refetchInterval: (q) => {
      const d = q.state.data as MetricoolReportsListResult | undefined;
      const hasInProgress = d?.history?.some(
        (r) => r.status === 'PENDING' || r.status === 'RUNNING' || r.status === 'RETRYING',
      );
      return hasInProgress ? 8000 : false;
    },
  });
}

export function useMetricoolReportDashboard(
  clientId: string,
  dashboardId: string | number | null,
  includeAnalytics = true,
) {
  return useQuery({
    queryKey: ['metricool-reports', clientId, 'get', String(dashboardId ?? '')],
    queryFn: async () => {
      const { data, error } = await apiInvoke('metricool-reports', {
        body: { clientId, mode: 'get', dashboardId, includeAnalytics },
      });
      if (error) throw error;
      return data as { dashboard: MetricoolPerformanceDashboard | null; analytics: any };
    },
    enabled: !!clientId && dashboardId != null,
    staleTime: FIVE_MIN,
  });
}

export function useGenerateMetricoolDashboard(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: GenerateDashboardVars) => {
      const { data, error } = await apiInvoke('metricool-reports', {
        body: { clientId, mode: 'generate', ...vars },
      });
      if (error) throw error;
      return (data as any)?.dashboard as MetricoolPerformanceDashboard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-reports', clientId, 'list'] });
    },
  });
}

export function useDeleteMetricoolDashboard(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dashboardId: string | number) => {
      const { error } = await apiInvoke('metricool-reports', {
        body: { clientId, mode: 'delete', dashboardId },
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-reports', clientId, 'list'] });
    },
  });
}

export function useSyncMetricoolDashboard(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dashboardId: string | number) => {
      const { data, error } = await apiInvoke('metricool-reports', {
        body: { clientId, mode: 'sync', dashboardId },
      });
      if (error) throw error;
      return (data as any)?.sync;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metricool-reports', clientId, 'list'] });
    },
  });
}

export function useMetricoolReportInsights(
  clientId: string,
  dashboardId: string | number | null,
) {
  return useQuery({
    queryKey: ['metricool-reports', clientId, 'insights', String(dashboardId ?? '')],
    queryFn: async () => {
      const { data, error } = await apiInvoke('metricool-reports', {
        body: { clientId, mode: 'insights', dashboardId },
      });
      if (error) throw error;
      return (data as any)?.insights;
    },
    enabled: !!clientId && dashboardId != null,
    staleTime: FIVE_MIN,
  });
}

export function useMetricoolReportBestPosts(
  clientId: string,
  dashboardId: string | number | null,
  metric?: string,
) {
  return useQuery({
    queryKey: [
      'metricool-reports',
      clientId,
      'best-posts',
      String(dashboardId ?? ''),
      metric || 'default',
    ],
    queryFn: async () => {
      const { data, error } = await apiInvoke('metricool-reports', {
        body: { clientId, mode: 'best-posts', dashboardId, metric },
      });
      if (error) throw error;
      return (data as any)?.bestPosts;
    },
    enabled: !!clientId && dashboardId != null,
    staleTime: FIVE_MIN,
  });
}
