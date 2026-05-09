// MetricoolPerformance — substitui KaiPerformanceTab antigo (que usava CSV +
// Apify scrape). Agora puxa TUDO do Metricool API.
//
// Estrutura: tab por plataforma + period selector + best times (heatmap).
// Cada tab mostra KPIs + sparkline + posts grid + leaderboard.
//
// Plataformas: instagram (com sub-tabs Posts/Reels/Stories), facebook, twitter,
// linkedin, tiktok, youtube, threads.
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Instagram,
  Twitter,
  Linkedin,
  Music2,
  Youtube,
  AtSign,
  Share2,
  RefreshCw,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { MetricoolBestTimesCard } from '@/components/metricool/MetricoolBestTimesCard';
import { PlatformDashboard } from './PlatformDashboard';
import { InstagramDashboardV2 } from './InstagramDashboard';
import { CrossPlatformComparison } from './CrossPlatformComparison';
import type { Client } from '@/hooks/useClients';
import type { MetricoolNetwork } from '@/hooks/useMetricoolPerformance';
import { BarChart3 } from 'lucide-react';

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

const ALL_PLATFORMS: Array<{ id: MetricoolNetwork; label: string; icon: any }> = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'twitter', label: 'X / Twitter', icon: Twitter },
  { id: 'threads', label: 'Threads', icon: AtSign },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'tiktok', label: 'TikTok', icon: Music2 },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'facebook', label: 'Facebook', icon: Share2 },
];

type ActiveTab = MetricoolNetwork | 'comparison';

export function MetricoolPerformance({ clientId, client }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('comparison');
  const [period, setPeriod] = useState<number>(30);
  const qc = useQueryClient();

  const archivedChannels: string[] = (client.social_media as any)?.archived_channels || [];
  const platforms = ALL_PLATFORMS.filter((p) => !archivedChannels.includes(p.id));

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['metricool-posts', clientId] });
    qc.invalidateQueries({ queryKey: ['metricool-reels', clientId] });
    qc.invalidateQueries({ queryKey: ['metricool-stories', clientId] });
    qc.invalidateQueries({ queryKey: ['metricool-analytics', clientId] });
    qc.invalidateQueries({ queryKey: ['metricool-best-times', clientId] });
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
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Best Times card — sempre visível acima das tabs */}
      <MetricoolBestTimesCard clientId={clientId} />

      {/* Platform tabs (com Comparativo no início) */}
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
            {platforms.map((p) => (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className="gap-1.5 sm:gap-2 px-2.5 sm:px-4 text-xs sm:text-sm"
              >
                <p.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{p.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="comparison" className="mt-4">
          <CrossPlatformComparison clientId={clientId} period={period} />
        </TabsContent>

        {platforms.map((p) => (
          <TabsContent key={p.id} value={p.id} className="mt-4">
            {p.id === 'instagram' ? (
              <InstagramDashboardV2 clientId={clientId} period={period} />
            ) : (
              <PlatformDashboard clientId={clientId} network={p.id} period={period} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
