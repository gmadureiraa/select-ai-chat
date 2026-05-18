// InstagramDashboard — dashboard especializado de IG com sub-tabs Posts/Reels/Stories.
//
// Late retorna todos os posts em `recentPosts` agregados (sem subtype na
// resposta atual). A gente filtra por heurística no client: URLs com "/reel/"
// viram Reels, "/stories/" viram Stories, resto é Post estático/carrossel.
//
// Quando a Late API expor `post_type` field a gente troca pra leitura direta.
import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Users,
  FileText,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Plug,
  Link2,
  Image as ImageIcon,
  Film,
  Camera,
} from 'lucide-react';
import { usePlatformData, type LatePost } from '@/hooks/useLatePerformance';
import { getNetworkBranding } from '@/lib/network-branding';
import { KPICard } from './KPICard';
import { FollowersChart } from './FollowersChart';
import { TopPostsList } from './TopPostsList';
import { formatNumber, formatPercent } from './_format';

interface Props {
  clientId: string;
  period: 7 | 30;
}

type IGPostType = 'post' | 'reel' | 'story';

function classifyPost(p: LatePost): IGPostType {
  const url = (p.url || '').toLowerCase();
  if (url.includes('/reel/') || url.includes('/reels/')) return 'reel';
  if (url.includes('/stories/') || url.includes('/story/')) return 'story';
  return 'post';
}

export function InstagramDashboard({ clientId, period }: Props) {
  const { platform: data, isLoading, error, notConnected } = usePlatformData(clientId, 'instagram', period);
  const branding = getNetworkBranding('instagram');

  const { posts, reels, stories } = useMemo(() => {
    const all = data?.recentPosts ?? [];
    return {
      posts: all.filter((p) => classifyPost(p) === 'post'),
      reels: all.filter((p) => classifyPost(p) === 'reel'),
      stories: all.filter((p) => classifyPost(p) === 'story'),
    };
  }, [data]);

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
                : error.message || 'Falha ao chamar Late Analytics.'
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && notConnected) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Link2}
            title="Conecte contas no Zernio"
            description="Esse cliente ainda não tem nenhuma rede conectada ao Late/Zernio. Conecte o Instagram pelas integrações pra começar a ver métricas."
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

  if (!isLoading && !data) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Plug}
            title="Instagram não conectado"
            description="Conecte o Instagram pelo perfil do cliente (aba Integrações) pra começar a ver métricas."
            action={
              <Button asChild variant="outline">
                <a href={`/kaleidos/clients?id=${clientId}&tab=integrations`}>
                  Conectar Instagram
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
          label="Posts totais"
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

      <FollowersChart
        stats={followerStats}
        color={branding.primaryHex}
        loading={isLoading}
        title="Crescimento — Instagram"
      />

      {/* Sub-tabs Posts/Reels/Stories */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="posts">
            <TabsList aria-label="Tipos de conteúdo do Instagram" className="bg-muted/50">
              <TabsTrigger value="posts" aria-label="Posts de feed" className="gap-2">
                <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
                Posts ({posts.length})
              </TabsTrigger>
              <TabsTrigger value="reels" aria-label="Reels" className="gap-2">
                <Film aria-hidden="true" className="h-3.5 w-3.5" />
                Reels ({reels.length})
              </TabsTrigger>
              <TabsTrigger value="stories" aria-label="Stories" className="gap-2">
                <Camera aria-hidden="true" className="h-3.5 w-3.5" />
                Stories ({stories.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-4">
              <TopPostsList
                posts={posts}
                loading={isLoading}
                title="Top posts (feed)"
                emptyMessage="Sem posts de feed no período."
                limit={10}
              />
            </TabsContent>

            <TabsContent value="reels" className="mt-4">
              <TopPostsList
                posts={reels}
                loading={isLoading}
                title="Top reels"
                emptyMessage="Sem reels no período."
                limit={10}
              />
            </TabsContent>

            <TabsContent value="stories" className="mt-4">
              <TopPostsList
                posts={stories}
                loading={isLoading}
                title="Top stories"
                emptyMessage="Stories normalmente expiram em 24h — Late pode não capturar todas."
                limit={10}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
