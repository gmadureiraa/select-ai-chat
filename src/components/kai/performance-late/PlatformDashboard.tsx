// PlatformDashboard — dashboard genérico por plataforma (LinkedIn, TikTok,
// YouTube, Threads, Facebook). Instagram tem componente próprio com sub-tabs
// (posts/reels/stories), X/Twitter usa modal manual.
//
// Layout:
//   1. KPI mini-row (4 cards: seguidores, posts, eng%, alcance)
//   2. Followers chart (área grande)
//   3. Top posts (lista ordenada por engagement)
//   4. Empty state se plataforma não conectada
import { Users, FileText, TrendingUp, Eye, Heart, MessageCircle, Plug, Link2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { usePlatformData, type LatePlatformId } from '@/hooks/useLatePerformance';
import { getNetworkBranding } from '@/lib/network-branding';
import { KPICard } from './KPICard';
import { FollowersChart } from './FollowersChart';
import { TopPostsList } from './TopPostsList';
import { formatNumber, formatPercent } from './_format';

interface Props {
  clientId: string;
  platform: LatePlatformId;
  period: 7 | 30;
}

export function PlatformDashboard({ clientId, platform, period }: Props) {
  const { platform: data, isLoading, error, notConnected } = usePlatformData(clientId, platform, period);
  const branding = getNetworkBranding(platform);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={Plug}
            title="Erro ao buscar dados"
            description={
              error.message?.includes('LATE_API_KEY')
                ? 'Late/Zernio não está configurado neste ambiente. Avise a equipe técnica.'
                : error.message || 'Falha ao chamar Late Analytics. Tente novamente em alguns instantes.'
            }
          />
        </CardContent>
      </Card>
    );
  }

  // Cliente não tem nenhum profile Late conectado — CTA mais explícito
  if (!isLoading && notConnected) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Link2}
            title="Conecte contas no Zernio"
            description="Esse cliente ainda não tem nenhuma rede conectada ao Late/Zernio. Conecte ao menos uma pelas integrações pra começar a ver métricas."
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

  // Late conectado mas essa plataforma específica não — empty state mais leve
  if (!isLoading && !data) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Plug}
            title={`${branding.label} não conectado`}
            description={`Conecte o ${branding.label} pelo perfil do cliente (aba Integrações) pra começar a ver métricas aqui.`}
            action={
              <Button asChild variant="outline">
                <a href={`/kaleidos/clients?id=${clientId}&tab=integrations`}>
                  Conectar {branding.label}
                </a>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const followerStats = data?.followerStats;
  const aggregates = data?.aggregates;
  const recentPosts = data?.recentPosts ?? [];

  const trendDir: 'up' | 'down' | 'flat' =
    !followerStats || followerStats.change7d === 0
      ? 'flat'
      : followerStats.change7d > 0
        ? 'up'
        : 'down';

  return (
    <div className="space-y-4">
      {/* KPI mini-row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Seguidores"
          value={formatNumber(followerStats?.current ?? 0)}
          icon={Users}
          trend={trendDir}
          trendValue={
            followerStats && followerStats.change7d !== 0
              ? `${followerStats.change7d > 0 ? '+' : ''}${formatNumber(followerStats.change7d)} (7d)`
              : undefined
          }
          loading={isLoading}
          accentColor={branding.primaryHex}
        />
        <KPICard
          label="Posts"
          value={aggregates?.postsCount ?? 0}
          subValue={`${period}d`}
          icon={FileText}
          loading={isLoading}
        />
        <KPICard
          label="Eng %"
          value={formatPercent(aggregates?.avgEngagementRate ?? 0)}
          icon={TrendingUp}
          loading={isLoading}
        />
        <KPICard
          label="Alcance"
          value={formatNumber(aggregates?.totalReach ?? 0)}
          subValue={
            aggregates?.totalImpressions
              ? `${formatNumber(aggregates.totalImpressions)} imp.`
              : undefined
          }
          icon={Eye}
          loading={isLoading}
        />
        <KPICard
          label="Curtidas"
          value={formatNumber(aggregates?.totalLikes ?? 0)}
          icon={Heart}
          loading={isLoading}
        />
        <KPICard
          label="Comentários"
          value={formatNumber(aggregates?.totalComments ?? 0)}
          icon={MessageCircle}
          loading={isLoading}
        />
      </div>

      {/* Followers chart */}
      <FollowersChart
        stats={followerStats}
        color={branding.primaryHex}
        loading={isLoading}
        title={`Crescimento — ${branding.label}`}
      />

      {/* Top posts */}
      <TopPostsList
        posts={recentPosts}
        loading={isLoading}
        title={`Top posts (${period}d)`}
        emptyMessage="Sem posts publicados no período ou Late ainda não sincronizou."
        limit={10}
      />
    </div>
  );
}
