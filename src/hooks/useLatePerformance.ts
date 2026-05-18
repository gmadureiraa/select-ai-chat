// useLatePerformance — wrapper useQuery em volta do handler `late-analytics`.
//
// O handler retorna `platforms: Record<platformId, { followerStats, recentPosts,
// aggregates }>` agregando posts dos últimos N dias por plataforma. Aqui só
// adicionamos cache TanStack + tipagem forte.
//
// Substitui o stub `useMetricoolPerformance.ts` (deixado vivo só pra compat
// de types em call-sites antigos).
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import { useToast } from '@/components/ui/use-toast';

// ─── Types ─────────────────────────────────────────────────────────────────

export type LatePlatformId =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'twitter';

export interface LatePostMetrics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

export interface LatePost {
  id: string;
  content: string;
  publishedAt: string;
  url: string;
  metrics: LatePostMetrics;
}

export interface LateFollowerStats {
  current: number;
  change7d: number;
  change30d: number;
  history: Array<{ date: string; followers: number }>;
}

export interface LatePlatformAggregates {
  avgEngagementRate: number;
  totalImpressions: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalReach: number;
  postsCount: number;
}

export interface LatePlatformData {
  followerStats: LateFollowerStats;
  recentPosts: LatePost[];
  aggregates: LatePlatformAggregates;
}

export interface LateAnalyticsResponse {
  success: boolean;
  lastSyncedAt?: string;
  message?: string;
  platforms: Partial<Record<LatePlatformId, LatePlatformData>>;
}

/**
 * Sinaliza que NÃO existe profile do Late conectado pro cliente.
 * Permite UI diferenciar "sem conexão" de "API devolveu vazio".
 */
export function isLateNotConnected(response: LateAnalyticsResponse | undefined): boolean {
  if (!response) return false;
  if (response.message === 'No Late profile connected') return true;
  return response.success === true && Object.keys(response.platforms ?? {}).length === 0;
}

function errorMessage(err: unknown, fallback = 'Erro desconhecido'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return fallback;
}

// ─── Hook principal — busca tudo de uma vez ───────────────────────────────

/**
 * Busca analytics agregadas de TODAS as plataformas conectadas via Late.
 * Período em dias (7 ou 30 por enquanto — handler aceita esses dois).
 *
 * Cache:
 *   - staleTime 5min (analytics atualizam devagar, sem precisar bater toda hora)
 *   - refetchOnWindowFocus desabilitado (evita custo desnecessário)
 *   - retry: 2 tentativas com backoff exponencial. Falhas de auth (4xx)
 *     não fazem retry pra evitar spam.
 */
export function useLateAnalytics(clientId: string | undefined, period: 7 | 30 = 30) {
  return useQuery<LateAnalyticsResponse, Error>({
    queryKey: ['late-analytics', clientId, period],
    enabled: !!clientId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // 4xx (incl. 401/403/422) provavelmente não vão melhorar com retry.
      const msg = error?.message ?? '';
      if (/40[0-9]/.test(msg)) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async () => {
      const { data, error } = await apiInvoke<LateAnalyticsResponse>('late-analytics', {
        body: { clientId, period },
      });
      if (error) throw new Error(error.message);
      return data ?? { success: false, platforms: {} };
    },
  });
}

/**
 * Helper pra extrair data de uma plataforma específica do response.
 * Retorna undefined se a plataforma não tem dados (ex: cliente sem conexão).
 */
export function usePlatformData(
  clientId: string | undefined,
  platform: LatePlatformId,
  period: 7 | 30 = 30,
) {
  const query = useLateAnalytics(clientId, period);
  return {
    ...query,
    platform: query.data?.platforms?.[platform],
    notConnected: isLateNotConnected(query.data),
  };
}

/**
 * Hook pra forçar refresh (invalida cache + refetch). Útil em botão "Atualizar".
 *
 * Aguarda o refetch terminar pra que `isPending` reflita o status REAL da
 * busca (antes o toast caía só pelo invalidate, mas o button voltava ao
 * normal antes da resposta nova chegar).
 */
export function useLateRefresh() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      // Late não tem endpoint "force refresh" público — a gente só invalida
      // o cache do TanStack e o useQuery re-bate na handler. O próprio
      // handler vai falar com a Late API que tem cache curto.
      await qc.invalidateQueries({ queryKey: ['late-analytics', clientId] });
      await qc.refetchQueries({ queryKey: ['late-analytics', clientId] });
    },
    onSuccess: () => {
      toast({
        title: 'Métricas atualizadas',
        description: 'Dados re-buscados via Late Analytics.',
      });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Erro ao atualizar',
        description: errorMessage(err, 'Falha ao buscar métricas'),
        variant: 'destructive',
      });
    },
  });
}

// ─── Aggregation helpers ──────────────────────────────────────────────────

export interface AggregatedTotals {
  totalFollowers: number;
  totalChange7d: number;
  totalPosts: number;
  totalImpressions: number;
  totalLikes: number;
  totalReach: number;
  avgEngagement: number;
  platformsConnected: number;
}

/**
 * Total combinado de TODAS plataformas (followers somados, posts somados, etc).
 * Útil pro CrossPlatformComparison.
 */
export function aggregateAllPlatforms(
  response: LateAnalyticsResponse | undefined,
): AggregatedTotals {
  const platforms = response?.platforms ?? {};
  let totalFollowers = 0;
  let totalChange7d = 0;
  let totalPosts = 0;
  let totalImpressions = 0;
  let totalLikes = 0;
  let totalReach = 0;
  let engagementSum = 0;
  let platformsWithEngagement = 0;

  for (const data of Object.values(platforms)) {
    if (!data) continue;
    totalFollowers += data.followerStats?.current || 0;
    totalChange7d += data.followerStats?.change7d || 0;
    totalPosts += data.aggregates?.postsCount || 0;
    totalImpressions += data.aggregates?.totalImpressions || 0;
    totalLikes += data.aggregates?.totalLikes || 0;
    totalReach += data.aggregates?.totalReach || 0;
    if ((data.aggregates?.avgEngagementRate || 0) > 0) {
      engagementSum += data.aggregates.avgEngagementRate;
      platformsWithEngagement++;
    }
  }

  return {
    totalFollowers,
    totalChange7d,
    totalPosts,
    totalImpressions,
    totalLikes,
    totalReach,
    avgEngagement: platformsWithEngagement > 0 ? engagementSum / platformsWithEngagement : 0,
    platformsConnected: Object.keys(platforms).length,
  };
}
