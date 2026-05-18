// LatePerformanceTab — root da aba Performance (Late/Zernio).
//
// Period selector global (7d / 30d) + tabs por plataforma:
//   - Comparativo (default) — CrossPlatformComparison
//   - Instagram — InstagramDashboard (sub-tabs Posts/Reels/Stories)
//   - Facebook, LinkedIn, TikTok, YouTube, Threads — PlatformDashboard genérico
//   - X/Twitter — XDashboard (lista de relatórios manuais + modal)
//
// Layout responsivo: tabs com scroll horizontal em mobile, period selector
// permanece visível no header. Cada dashboard de plataforma é envelopado em
// ErrorBoundary próprio pra que um crash de uma rede não derrube as outras.
//
// Persistência: período fica salvo em localStorage por cliente
// (`kai:late-period:<clientId>`) pra que o usuário não precise re-selecionar
// 7d/30d a cada visita.
import { Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useLateRefresh, type LatePlatformId } from '@/hooks/useLatePerformance';
import { CORE_NETWORKS, getNetworkBranding } from '@/lib/network-branding';
import { cn } from '@/lib/utils';
import type { Client } from '@/hooks/useClients';

// Dashboards são lazy — só baixam quando o user clica na tab.
const CrossPlatformComparison = lazyWithRetry(() =>
  import('./CrossPlatformComparison').then((m) => ({ default: m.CrossPlatformComparison })),
);
const PlatformDashboard = lazyWithRetry(() =>
  import('./PlatformDashboard').then((m) => ({ default: m.PlatformDashboard })),
);
const InstagramDashboard = lazyWithRetry(() =>
  import('./InstagramDashboard').then((m) => ({ default: m.InstagramDashboard })),
);
const XDashboard = lazyWithRetry(() =>
  import('./XDashboard').then((m) => ({ default: m.XDashboard })),
);

interface Props {
  clientId: string;
  client: Client;
}

type PeriodValue = 7 | 30;

const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodValue; label: string }> = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
];

type ActiveTab = LatePlatformId | 'comparison';

const PERIOD_STORAGE_KEY = (clientId: string) => `kai:late-period:${clientId}`;

function readPersistedPeriod(clientId: string): PeriodValue {
  if (typeof window === 'undefined') return 30;
  try {
    const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY(clientId));
    if (raw === '7' || raw === '30') return Number(raw) as PeriodValue;
  } catch {
    // ignore — privacy mode / quota
  }
  return 30;
}

/**
 * Loader skeleton em vez de spinner solitário — preserva layout enquanto
 * o chunk do dashboard baixa.
 */
function DashboardLoader() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando dashboard…</span>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="w-full h-[200px] rounded-lg" />
      <Skeleton className="w-full h-[160px] rounded-lg" />
    </div>
  );
}

export function LatePerformanceTab({ clientId, client }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('comparison');
  const [period, setPeriodState] = useState<PeriodValue>(() => readPersistedPeriod(clientId));
  const refresh = useLateRefresh();

  // Quando o cliente muda, recarrega a preferência salva (ou cai pro default).
  useEffect(() => {
    setPeriodState(readPersistedPeriod(clientId));
  }, [clientId]);

  const setPeriod = useCallback(
    (next: PeriodValue) => {
      setPeriodState(next);
      try {
        window.localStorage.setItem(PERIOD_STORAGE_KEY(clientId), String(next));
      } catch {
        // ignore — quota / private mode
      }
    },
    [clientId],
  );

  // Aplica filtros de canais arquivados (lê de client.social_media).
  const archivedChannels = useMemo(() => {
    const sm = (client?.social_media ?? {}) as Record<string, unknown>;
    const raw = sm.archived_channels;
    return Array.isArray(raw)
      ? raw.filter((c): c is string => typeof c === 'string')
      : [];
  }, [client]);

  const platforms = useMemo(
    () =>
      CORE_NETWORKS.filter((p) => !archivedChannels.includes(p)).map((id) => ({
        id: id as LatePlatformId,
        branding: getNetworkBranding(id),
      })),
    [archivedChannels],
  );

  const handleRefresh = useCallback(() => {
    refresh.mutate(clientId);
  }, [refresh, clientId]);

  return (
    <div className="space-y-4">
      {/* Header — eyebrow + period selector + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="kai-eyebrow">Performance · Late</span>
          <h2 className="text-2xl font-bold mt-1">{client?.name || 'Cliente'}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Métricas de redes sociais via Late/Zernio Analytics. Atualizado periodicamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex rounded-md border bg-muted/30 overflow-hidden"
            role="group"
            aria-label="Selecionar período"
          >
            {PERIOD_OPTIONS.map((p) => {
              const selected = period === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  aria-pressed={selected}
                  aria-label={`Período ${p.label === '7d' ? '7 dias' : '30 dias'}`}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refresh.isPending}
            className="gap-1.5"
            aria-label={refresh.isPending ? 'Atualizando métricas…' : 'Atualizar métricas via Late Analytics'}
            title="Re-busca métricas via Late Analytics"
          >
            {refresh.isPending ? (
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {refresh.isPending ? 'Atualizando…' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Tabs por plataforma */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList aria-label="Plataformas" className="bg-muted/50 inline-flex min-w-max">
            <TabsTrigger
              value="comparison"
              aria-label="Comparativo entre plataformas"
              className="gap-1.5 sm:gap-2 px-2.5 sm:px-4 text-xs sm:text-sm"
            >
              <BarChart3 aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Comparativo</span>
            </TabsTrigger>
            {platforms.map((p) => {
              const Icon = p.branding.icon;
              const isActive = activeTab === p.id;
              return (
                <TabsTrigger
                  key={p.id}
                  value={p.id}
                  aria-label={`Dashboard ${p.branding.label}`}
                  className={cn(
                    'gap-1.5 sm:gap-2 px-2.5 sm:px-4 text-xs sm:text-sm transition-all',
                    'data-[state=active]:shadow-sm',
                    isActive && p.branding.accentBg,
                  )}
                  style={
                    isActive
                      ? { boxShadow: `inset 0 -2px 0 ${p.branding.primaryHex}` }
                      : undefined
                  }
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      'h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors',
                      isActive && p.branding.textColor,
                    )}
                  />
                  <span>{p.branding.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="comparison" className="mt-4">
          <ErrorBoundary compact context="Performance · Comparativo">
            <Suspense fallback={<DashboardLoader />}>
              <CrossPlatformComparison clientId={clientId} period={period} />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>

        {platforms.map((p) => (
          <TabsContent key={p.id} value={p.id} className="mt-4">
            <ErrorBoundary compact context={`Performance · ${p.branding.label}`}>
              <Suspense fallback={<DashboardLoader />}>
                {p.id === 'instagram' ? (
                  <InstagramDashboard clientId={clientId} period={period} />
                ) : p.id === 'twitter' ? (
                  <XDashboard clientId={clientId} />
                ) : (
                  <PlatformDashboard clientId={clientId} platform={p.id} period={period} />
                )}
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Default export pra facilitar lazy import.
export default LatePerformanceTab;
