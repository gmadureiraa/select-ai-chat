// PlanningItemPerformance — seção de métricas pós-publicação no PlanningItemDialog.
//
// Renderiza só quando item.status === 'published' E há postId no metadata.
// Source of truth: item.external_post_id (Late post id). Fallback legacy:
// metadata.metricool_post_id pra cards publicados antes da migração 2026-05-18.
// Lê metrics persistidas em metadata.metrics e oferece botão de "atualizar agora".
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Heart,
  MessageCircle,
  Eye,
  Repeat2,
  Bookmark,
  RefreshCw,
  ExternalLink,
  Loader2,
  TrendingUp,
  LineChart,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useFetchPostMetrics, getPlanningItemMetrics } from '@/hooks/usePostMetrics';
import type { PlanningItem } from '@/hooks/usePlanningItems';

interface Props {
  item: PlanningItem;
}

const ptBRFmt = new Intl.NumberFormat('pt-BR');
function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '0';
  if (n >= 1000) {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return ptBRFmt.format(n);
}

export function PlanningItemPerformance({ item }: Props) {
  const fetchMetrics = useFetchPostMetrics();
  const navigate = useNavigate();
  const metadata = (item.metadata as Record<string, any>) || {};
  const postId = item.external_post_id || metadata.metricool_post_id;
  const publishedUrl = metadata.published_url as string | undefined;
  const metrics = getPlanningItemMetrics(item);

  // Só renderiza se o post foi publicado E tem id de tracking
  if (item.status !== 'published' || !postId) return null;

  const lastSyncedLabel = metrics?.last_synced_at
    ? formatDistanceToNow(parseISO(metrics.last_synced_at), { locale: ptBR, addSuffix: true })
    : null;

  const engRate = metrics?.eng_rate ?? 0;
  const engGood = engRate > 5;
  const engOk = engRate > 2 && engRate <= 5;

  return (
    <Card className="bg-emerald-500/5 border-emerald-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-sm font-semibold">Performance pós-publicação</CardTitle>
          </div>
          {metrics && (
            <Badge
              variant={engGood ? 'default' : engOk ? 'secondary' : 'outline'}
              className="text-[10px] tabular-nums"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {engRate.toFixed(1)}% eng
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs mt-1">
          {metrics ? (
            <>Última atualização {lastSyncedLabel}</>
          ) : (
            <>Sem métricas ainda. Clique em "Atualizar" para buscar agora.</>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-md border border-border/40 bg-card p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Heart className="h-3 w-3 text-rose-500" />
                Likes
              </div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(metrics.likes)}</div>
            </div>
            <div className="rounded-md border border-border/40 bg-card p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <MessageCircle className="h-3 w-3 text-sky-500" />
                Comentários
              </div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(metrics.comments)}</div>
            </div>
            <div className="rounded-md border border-border/40 bg-card p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Eye className="h-3 w-3 text-emerald-500" />
                Alcance
              </div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(metrics.reach)}</div>
            </div>
            <div className="rounded-md border border-border/40 bg-card p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Repeat2 className="h-3 w-3 text-purple-500" />
                Compart.
              </div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(metrics.shares)}</div>
            </div>

            {(metrics.impressions > 0 || metrics.video_views > 0 || metrics.saves > 0) && (
              <>
                {metrics.impressions > 0 && (
                  <div className="rounded-md border border-border/40 bg-card p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Impressões
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">
                      {fmt(metrics.impressions)}
                    </div>
                  </div>
                )}
                {metrics.video_views > 0 && (
                  <div className="rounded-md border border-border/40 bg-card p-2.5">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Views (vídeo)
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">
                      {fmt(metrics.video_views)}
                    </div>
                  </div>
                )}
                {metrics.saves > 0 && (
                  <div className="rounded-md border border-border/40 bg-card p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                      <Bookmark className="h-3 w-3" />
                      Salvos
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">{fmt(metrics.saves)}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={fetchMetrics.isPending}
            onClick={() =>
              fetchMetrics.mutate({ planningItemId: item.id, force: true })
            }
          >
            {fetchMetrics.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Atualizar agora
          </Button>

          {publishedUrl && (
            <Button asChild type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver post original
              </a>
            </Button>
          )}

          {/* Cross-feature: deep-link pro Performance Dashboard com filtro neste cliente.
              Usa ?postId pra que dashboard possa scrollar pra esse post. */}
          {item.client_id && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                const params = new URLSearchParams({
                  tab: 'performance',
                  client: item.client_id!,
                });
                if (postId) params.set('postId', String(postId));
                navigate(`/kaleidos?${params.toString()}`);
              }}
            >
              <LineChart className="h-3.5 w-3.5" />
              Ver no Performance Dashboard
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
