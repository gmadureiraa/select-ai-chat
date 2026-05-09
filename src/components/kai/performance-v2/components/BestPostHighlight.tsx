// BestPostHighlight — destaca o melhor post do período como card grande
// com thumbnail, métricas em destaque e CTA pra abrir externamente.
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Trophy, ExternalLink, Image as ImageIcon, FileText, ListChecks } from 'lucide-react';
import { useOpenPlanningFromPost } from '@/hooks/useOpenPlanningFromPost';
import { type MetricoolPost, getPostMetric, topPostsByMetric } from '@/hooks/useMetricoolPerformance';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PostTranscriptionDialog } from './PostTranscriptionDialog';
import type { TranscriptionSource } from '@/hooks/usePostTranscription';
import { getNetworkBranding } from '@/lib/network-branding';
import { cn } from '@/lib/utils';

interface Props {
  posts: MetricoolPost[];
  loading?: boolean;
  network?: string;
  /** Habilita botão "Transcrição". */
  clientId?: string;
  /** Default: 'metricool' */
  transcriptionSource?: TranscriptionSource;
}

const METRICS = [
  { value: 'engagement', label: 'Engajamento %' },
  { value: 'reach', label: 'Alcance' },
  { value: 'likes', label: 'Likes' },
  { value: 'comments', label: 'Comentários' },
  { value: 'impressions', label: 'Impressões' },
] as const;

function fmt(n: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(n);
}

function getCaption(p: MetricoolPost): string {
  return String(p.caption || p.text || p.content || '').trim();
}

function getThumb(p: MetricoolPost): string | null {
  return (p.imageUrl || p.thumbnail || p.mediaUrl || null) as string | null;
}

function getUrl(p: MetricoolPost): string | null {
  return (p.url || p.permalink || null) as string | null;
}

export function BestPostHighlight({ posts, loading, network, clientId, transcriptionSource = 'metricool' }: Props) {
  const openPlanning = useOpenPlanningFromPost();
  const [metric, setMetric] = useState<typeof METRICS[number]['value']>('engagement');
  const branding = getNetworkBranding(network);

  if (loading) return <Skeleton className="h-[260px] w-full" />;

  const top = topPostsByMetric(posts, metric, 1)[0];
  if (!top) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground text-center">
          Sem posts no período pra eleger o destaque.
        </CardContent>
      </Card>
    );
  }

  const caption = getCaption(top);
  const thumb = getThumb(top);
  const url = getUrl(top);
  const score = getPostMetric(top, metric);
  const date = top.date || top.publishedAt || top.publishDate;

  // Border + trophy + stat card "primário" (métrica selecionada) tintados com
  // a cor da rede — single source via getNetworkBranding.
  // 4D = 30% opacity em hex (nível 77/255 ≈ 0.30).
  return (
    <Card
      className="overflow-hidden border"
      style={{ borderColor: branding.primaryHex + '4D' }}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: branding.primaryHex }} />
            <span className="kai-eyebrow text-xs">Post de destaque</span>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <SelectTrigger className="w-[160px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            {thumb ? (
              <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
                <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                <Badge className="absolute top-2 right-2 bg-amber-500 hover:bg-amber-500 gap-1">
                  <Trophy className="h-3 w-3" /> #1
                </Badge>
              </div>
            ) : (
              <div className="aspect-square rounded-md bg-muted flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-3">
            <div>
              <p className="text-sm leading-relaxed line-clamp-4">{caption || '(sem legenda)'}</p>
              {date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Publicado em {new Date(date as string).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Likes</div>
                <div className="text-lg font-bold tabular-nums flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-red-500" />
                  {fmt(getPostMetric(top, 'likes'))}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Comments</div>
                <div className="text-lg font-bold tabular-nums flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5 text-sky-500" />
                  {fmt(getPostMetric(top, 'comments'))}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Alcance</div>
                <div className="text-lg font-bold tabular-nums flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-emerald-500" />
                  {fmt(getPostMetric(top, 'reach'))}
                </div>
              </div>
              <div
                className={cn('rounded-md border p-2', branding.accentBg, branding.borderColor)}
              >
                <div
                  className={cn('text-[10px] uppercase tracking-wider font-semibold', branding.textColor)}
                >
                  {METRICS.find((m) => m.value === metric)?.label}
                </div>
                <div
                  className={cn('text-lg font-bold tabular-nums', branding.textColor)}
                >
                  {metric === 'engagement' ? `${score.toFixed(2)}%` : fmt(score)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => openPlanning({ id: top.id as string | number, url: url || undefined })}
              >
                <ListChecks className="h-3.5 w-3.5" />
                Abrir no Planejamento
              </Button>
              {url && (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver post original
                  </a>
                </Button>
              )}
              {clientId ? (
                <PostTranscriptionDialog
                  clientId={clientId}
                  post={top as any}
                  source={transcriptionSource}
                  network={network || 'instagram'}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1.5" type="button">
                      <FileText className="h-3.5 w-3.5" />
                      Transcrição
                    </Button>
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
