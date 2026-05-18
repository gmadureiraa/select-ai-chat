// CrossPlatformComparison — view comparativa entre todas as plataformas conectadas.
//
// Bar chart vertical com followers por rede + tabela detalhada com posts, eng%
// e alcance por plataforma. Foco em ver "onde tô crescendo melhor" sem entrar
// em rede específica.
import { useMemo } from 'react';
import { BarChart3, Users, FileText, TrendingUp, Eye, Plug, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { VerticalBarChart } from '@/components/kai/charts/svg-primitives';
import {
  useLateAnalytics,
  aggregateAllPlatforms,
  isLateNotConnected,
  type LatePlatformId,
} from '@/hooks/useLatePerformance';
import { getNetworkBranding } from '@/lib/network-branding';
import { KPICard } from './KPICard';
import { formatNumber, formatPercent } from './_format';

interface Props {
  clientId: string;
  period: 7 | 30;
}

export function CrossPlatformComparison({ clientId, period }: Props) {
  const { data, isLoading, error } = useLateAnalytics(clientId, period);

  const totals = useMemo(() => aggregateAllPlatforms(data), [data]);

  const platformRows = useMemo(() => {
    const platforms = data?.platforms ?? {};
    return (Object.keys(platforms) as LatePlatformId[])
      .map((id) => {
        const p = platforms[id]!;
        const branding = getNetworkBranding(id);
        return {
          id,
          label: branding.label,
          color: branding.primaryHex,
          followers: p.followerStats?.current ?? 0,
          change7d: p.followerStats?.change7d ?? 0,
          posts: p.aggregates?.postsCount ?? 0,
          engagement: p.aggregates?.avgEngagementRate ?? 0,
          reach: p.aggregates?.totalReach ?? 0,
          impressions: p.aggregates?.totalImpressions ?? 0,
        };
      })
      .sort((a, b) => b.followers - a.followers);
  }, [data]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={Plug}
            title="Erro ao carregar comparativo"
            description={
              error.message?.includes('LATE_API_KEY')
                ? 'Late/Zernio não está configurado neste ambiente. Avise a equipe técnica.'
                : error.message || 'Não conseguimos buscar as métricas. Tente novamente em alguns instantes.'
            }
          />
        </CardContent>
      </Card>
    );
  }

  // Cliente sem Late conectado — empty state com CTA pra integração
  if (!isLoading && isLateNotConnected(data)) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Link2}
            title="Conecte contas no Zernio"
            description="Esse cliente ainda não tem nenhuma conta conectada ao Late/Zernio. Conecte ao menos uma rede social pelas integrações pra começar a ver métricas aqui."
            action={
              <Button asChild variant="default">
                <a href={`/kaleidos/clients?id=${clientId}&tab=integrations`}>
                  Abrir integrações
                </a>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && platformRows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Plug}
            title="Sem dados no período"
            description="As contas estão conectadas, mas o Late ainda não retornou métricas pro intervalo escolhido. Tente alargar o período ou aguardar a próxima sincronização."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs globais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard
          label="Followers totais"
          value={formatNumber(totals.totalFollowers)}
          icon={Users}
          trend={totals.totalChange7d === 0 ? 'flat' : totals.totalChange7d > 0 ? 'up' : 'down'}
          trendValue={
            totals.totalChange7d !== 0
              ? `${totals.totalChange7d > 0 ? '+' : ''}${formatNumber(totals.totalChange7d)} (7d)`
              : undefined
          }
          loading={isLoading}
        />
        <KPICard
          label="Posts (todos)"
          value={totals.totalPosts}
          subValue={`${period}d`}
          icon={FileText}
          loading={isLoading}
        />
        <KPICard
          label="Eng % médio"
          value={formatPercent(totals.avgEngagement)}
          icon={TrendingUp}
          loading={isLoading}
        />
        <KPICard
          label="Alcance total"
          value={formatNumber(totals.totalReach)}
          subValue={
            totals.totalImpressions
              ? `${formatNumber(totals.totalImpressions)} imp.`
              : undefined
          }
          icon={Eye}
          loading={isLoading}
        />
        <KPICard
          label="Plataformas"
          value={totals.platformsConnected}
          icon={BarChart3}
          loading={isLoading}
        />
      </div>

      {/* Bar chart de followers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Seguidores por rede</CardTitle>
          <CardDescription>Ranking das plataformas conectadas pelo Late.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="w-full h-[200px]" />
          ) : platformRows.every((r) => r.followers === 0) ? (
            <Alert>
              <AlertTitle>Zero seguidores reportados</AlertTitle>
              <AlertDescription>
                As plataformas estão conectadas, mas o Late ainda não capturou contagem de seguidores. Pode levar até 24h após a conexão.
              </AlertDescription>
            </Alert>
          ) : (
            <VerticalBarChart
              data={platformRows.map((r) => ({ label: r.label, value: r.followers }))}
              color="hsl(var(--primary))"
              height={220}
              formatValue={formatNumber}
              ariaLabel="Gráfico de barras com seguidores por plataforma"
            />
          )}
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Detalhes por plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Métricas detalhadas por plataforma — seguidores, variação semanal, posts, engajamento e alcance.
                </caption>
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 px-2 text-left font-medium">Plataforma</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Seguidores</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Δ 7d</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Posts</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Eng %</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Alcance</th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: r.color }}
                          />
                          <span className="font-medium">{r.label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium">
                        {formatNumber(r.followers)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        <span
                          className={
                            r.change7d > 0
                              ? 'text-emerald-500'
                              : r.change7d < 0
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                          }
                        >
                          {r.change7d > 0 ? '+' : ''}
                          {formatNumber(r.change7d)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.posts}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatPercent(r.engagement)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatNumber(r.reach)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
