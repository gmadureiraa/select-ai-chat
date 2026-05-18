// MetricoolPerformance — substitui KaiPerformanceTab antigo (que usava CSV +
// Apify scrape). Agora puxa TUDO do Metricool API.
//
// Estrutura: tab por plataforma + period selector + best times (heatmap).
// Cada tab mostra KPIs + sparkline + posts grid + leaderboard.
//
// Plataformas: instagram (com sub-tabs Posts/Reels/Stories), facebook, twitter,
// linkedin, tiktok, youtube, threads.
import { useState, lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import { toast } from 'sonner';
// MetricoolBestTimesCard agora é renderizado DENTRO de cada plataforma
// (último bloco de cada PlatformDashboard / InstagramDashboardV2), não global.
// 2026-05-17 — Dashboards per-tab lazy. Cada um tem charts (SVG primitives custom,
// ~10kB) e queries próprias; só baixa quando o user navega pra aquela tab.
// CrossPlatformComparison é a default mas ainda assim lazy — mantém initial bundle baixo.
const PlatformDashboard = lazy(() =>
  import('./PlatformDashboard').then((m) => ({ default: m.PlatformDashboard })),
);
const InstagramDashboardV2 = lazy(() =>
  import('./InstagramDashboard').then((m) => ({ default: m.InstagramDashboardV2 })),
);
const CrossPlatformComparison = lazy(() =>
  import('./CrossPlatformComparison').then((m) => ({
    default: m.CrossPlatformComparison,
  })),
);

function DashboardLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
import type { Client } from '@/hooks/useClients';
import type { MetricoolNetwork } from '@/hooks/useMetricoolPerformance';
import { BarChart3 } from 'lucide-react';
import {
  CORE_NETWORKS,
  getNetworkBranding,
} from '@/lib/network-branding';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
  client: Client;
}

const PERIOD_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6m' },
  { value: 365, label: '1a' },
];

// Lista canônica vem de network-branding.ts — sem mais hardcode.
const ALL_PLATFORMS = CORE_NETWORKS.map((id) => {
  const b = getNetworkBranding(id);
  return { id: id as MetricoolNetwork, label: b.label, branding: b };
});

type ActiveTab = MetricoolNetwork | 'comparison';

export function MetricoolPerformance({ clientId, client }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('comparison');
  const [period, setPeriod] = useState<number>(30);
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();

  const archivedChannels: string[] = (client.social_media as any)?.archived_channels || [];
  const platforms = ALL_PLATFORMS.filter((p) => !archivedChannels.includes(p.id));

  // 2026-05-18 — antes só invalidava cache local; agora dispara refresh REAL do
  // Metricool (backfill posts + snapshot + poll + fetch published). Resposta
  // tipica: 4-8s. Depois invalida queries pra re-fetchar do Neon.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const toastId = toast.loading('Puxando dados frescos do Metricool…');
    try {
      const { data, error } = await apiInvoke<{
        ok: boolean;
        total_duration_ms: number;
        steps: Array<{ step: string; ok: boolean; durationMs: number; error?: string }>;
        errors: string[];
      }>('metricool-refresh-now', { body: {} });
      if (error) throw new Error(error.message || 'Falha ao chamar refresh');
      if (!data?.ok) {
        toast.error(`Refresh parcial: ${data?.errors?.join(' | ') ?? 'erros desconhecidos'}`, {
          id: toastId,
        });
      } else {
        toast.success(`Atualizado em ${(data.total_duration_ms / 1000).toFixed(1)}s`, {
          id: toastId,
        });
      }
      // Re-fetch queries locais com dados frescos do Neon
      qc.invalidateQueries({ queryKey: ['metricool-posts', clientId] });
      qc.invalidateQueries({ queryKey: ['metricool-reels', clientId] });
      qc.invalidateQueries({ queryKey: ['metricool-stories', clientId] });
      qc.invalidateQueries({ queryKey: ['metricool-analytics', clientId] });
      qc.invalidateQueries({ queryKey: ['metricool-best-times', clientId] });
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`, { id: toastId });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header — eyebrow + period selector + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="kai-eyebrow">Performance · Metricool</span>
          <h2 className="text-2xl font-bold mt-1">{client.name || 'Cliente'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border bg-muted/30 overflow-hidden">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={
                  'px-3 py-1.5 text-xs font-medium transition ' +
                  (period === p.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground')
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5"
            title="Puxa dados frescos do Metricool (~5-10s). Cron diário roda 3h BRT automaticamente."
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Platform tabs (com Comparativo no início).
          Best Times agora é renderizado dentro de CADA plataforma, não global. */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList className="bg-muted/50 inline-flex min-w-max">
            <TabsTrigger
              value="comparison"
              className="gap-1.5 sm:gap-2 px-2.5 sm:px-4 text-xs sm:text-sm"
            >
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Comparativo</span>
            </TabsTrigger>
            {platforms.map((p) => {
              const Icon = p.branding.icon;
              const isActive = activeTab === p.id;
              return (
                <TabsTrigger
                  key={p.id}
                  value={p.id}
                  className={cn(
                    'gap-1.5 sm:gap-2 px-2.5 sm:px-4 text-xs sm:text-sm transition-all',
                    'data-[state=active]:shadow-sm',
                    // Quando ativa, ganha tint sutil + borda inferior na cor da rede
                    isActive && p.branding.accentBg,
                    isActive &&
                      'data-[state=active]:ring-1 ' + p.branding.ringColor,
                  )}
                  style={
                    isActive
                      ? { boxShadow: `inset 0 -2px 0 ${p.branding.primaryHex}` }
                      : undefined
                  }
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors',
                      isActive && p.branding.textColor,
                    )}
                  />
                  <span>{p.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="comparison" className="mt-4">
          <Suspense fallback={<DashboardLoader />}>
            <CrossPlatformComparison
              clientId={clientId}
              period={period}
              archivedChannels={archivedChannels}
            />
          </Suspense>
        </TabsContent>

        {platforms.map((p) => (
          <TabsContent key={p.id} value={p.id} className="mt-4">
            <Suspense fallback={<DashboardLoader />}>
              {p.id === 'instagram' ? (
                <InstagramDashboardV2 clientId={clientId} period={period} />
              ) : (
                <PlatformDashboard clientId={clientId} network={p.id} period={period} />
              )}
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
