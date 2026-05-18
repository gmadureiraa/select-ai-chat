// TopPostsList — lista dos top N posts ordenada por engagement.
// Usa direto LatePost do useLatePerformance — sem fetch próprio.
import { ExternalLink, Heart, MessageCircle, Repeat2, Eye, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatPercent, formatDateShort, truncate } from './_format';
import type { LatePost } from '@/hooks/useLatePerformance';

interface Props {
  posts: LatePost[];
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
  limit?: number;
}

export function TopPostsList({
  posts,
  loading,
  title = 'Top posts',
  emptyMessage = 'Sem posts no período.',
  limit = 5,
}: Props) {
  const top = posts.slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">Carregando posts…</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : top.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-2 py-8">
            <Inbox aria-hidden="true" className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ol className="space-y-2 list-none">
            {top.map((p, i) => (
              <li key={p.id || i}>
                <a
                  href={p.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Post ${i + 1}: ${truncate(p.content || 'Sem caption', 80)}`}
                  className="block rounded-lg border border-border/60 p-3 transition hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5 font-mono">
                      #{i + 1}
                    </Badge>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm text-foreground leading-snug">
                        {truncate(p.content || 'Sem caption', 140)}
                      </p>
                      <div className="flex items-center flex-wrap gap-3 text-[11px] text-muted-foreground tabular-nums">
                        {p.publishedAt && (
                          <span>{formatDateShort(p.publishedAt)}</span>
                        )}
                        {p.metrics.impressions > 0 && (
                          <span className="flex items-center gap-1" aria-label={`${formatNumber(p.metrics.impressions)} impressões`}>
                            <Eye aria-hidden="true" className="h-3 w-3" /> {formatNumber(p.metrics.impressions)}
                          </span>
                        )}
                        {p.metrics.likes > 0 && (
                          <span className="flex items-center gap-1" aria-label={`${formatNumber(p.metrics.likes)} curtidas`}>
                            <Heart aria-hidden="true" className="h-3 w-3" /> {formatNumber(p.metrics.likes)}
                          </span>
                        )}
                        {p.metrics.comments > 0 && (
                          <span className="flex items-center gap-1" aria-label={`${formatNumber(p.metrics.comments)} comentários`}>
                            <MessageCircle aria-hidden="true" className="h-3 w-3" /> {formatNumber(p.metrics.comments)}
                          </span>
                        )}
                        {p.metrics.shares > 0 && (
                          <span className="flex items-center gap-1" aria-label={`${formatNumber(p.metrics.shares)} compartilhamentos`}>
                            <Repeat2 aria-hidden="true" className="h-3 w-3" /> {formatNumber(p.metrics.shares)}
                          </span>
                        )}
                        {p.metrics.engagementRate > 0 && (
                          <span className="font-medium text-foreground">
                            {formatPercent(p.metrics.engagementRate)} eng
                          </span>
                        )}
                      </div>
                    </div>
                    {p.url && (
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-1" />
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
