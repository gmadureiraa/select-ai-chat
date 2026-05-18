// useXManualReports — CRUD pra relatórios manuais do X/Twitter.
//
// X API custaria USD 100-5000/mês — o usuário cola números do
// twitter.com/analytics em modal e a gente salva em client_x_manual_reports.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import { useToast } from '@/components/ui/use-toast';

export interface XTopTweet {
  url?: string;
  text?: string;
  impressions?: number;
  likes?: number;
}

export interface XManualReport {
  id: string;
  client_id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  impressions: number;
  engagements: number;
  likes: number;
  replies: number;
  retweets: number;
  bookmarks: number;
  profile_visits: number;
  new_followers: number;
  notes: string | null;
  top_tweets: XTopTweet[];
  created_at: string;
  updated_at: string;
}

export interface CreateXReportInput {
  periodStart: string;
  periodEnd: string;
  impressions: number;
  engagements: number;
  likes: number;
  replies: number;
  retweets: number;
  bookmarks: number;
  profileVisits: number;
  newFollowers: number;
  notes?: string;
  topTweets?: XTopTweet[];
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return fallback;
}

export function useXManualReports(clientId: string | undefined) {
  return useQuery<XManualReport[], Error>({
    queryKey: ['x-manual-reports', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (/40[0-9]/.test(error?.message ?? '')) return false;
      return failureCount < 2;
    },
    queryFn: async () => {
      const { data, error } = await apiInvoke<{ success: boolean; reports: XManualReport[] }>(
        'x-manual-report',
        { body: { clientId, action: 'list' } },
      );
      if (error) throw new Error(error.message);
      return data?.reports ?? [];
    },
  });
}

export function useCreateXManualReport(clientId: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateXReportInput) => {
      if (!clientId) throw new Error('clientId is required');
      const { data, error } = await apiInvoke<{ success: boolean; report: XManualReport }>(
        'x-manual-report',
        { body: { clientId, action: 'create', ...input } },
      );
      if (error) throw new Error(error.message);
      return data?.report;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['x-manual-reports', clientId] });
      toast({ title: 'Relatório salvo', description: 'Métricas do X registradas com sucesso.' });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erro ao salvar',
        description: errorMessage(err, 'Falha ao salvar relatório'),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteXManualReport(clientId: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!clientId) throw new Error('clientId is required');
      const { error } = await apiInvoke('x-manual-report', {
        body: { clientId, action: 'delete', id },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['x-manual-reports', clientId] });
      toast({ title: 'Relatório removido' });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erro ao remover',
        description: errorMessage(err, 'Falha ao remover relatório'),
        variant: 'destructive',
      });
    },
  });
}
