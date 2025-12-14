import { useState } from "react";
import { BarChart3, Users, Eye, Instagram, Twitter, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { EnhancedKPICard } from "@/components/performance/EnhancedKPICard";
import { YouTubeConnectionCard } from "@/components/performance/YouTubeConnectionCard";
import { TwitterConnectionCard } from "@/components/performance/TwitterConnectionCard";
import { TwitterCSVUpload } from "@/components/performance/TwitterCSVUpload";
import { YouTubeCSVUpload } from "@/components/performance/YouTubeCSVUpload";
import { PerformanceOverview } from "@/components/performance/PerformanceOverview";
import { YouTubeVideosTable } from "@/components/performance/YouTubeVideosTable";
import { InstagramDashboard } from "@/components/performance/InstagramDashboard";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";

interface KaiPerformanceTabProps {
  clientId: string;
  client: Client;
}

const channels = [
  { id: "overview", label: "Geral", icon: BarChart3 },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Eye },
  { id: "twitter", label: "X", icon: Twitter },
  { id: "newsletter", label: "Newsletter", icon: Users },
];

export const KaiPerformanceTab = ({ clientId, client }: KaiPerformanceTabProps) => {
  const [activeChannel, setActiveChannel] = useState("overview");
  
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 365);
  const { data: instagramPosts, isLoading: isLoadingInstagramPosts } = useInstagramPosts(clientId, 500);
  const { data: videos, isLoading: isLoadingVideos } = useYouTubeVideos(clientId, 100);
  const { data: twitterMetrics } = usePerformanceMetrics(clientId, "twitter", 90);

  // YouTube metrics from videos
  const totalViews = videos?.reduce((sum, v) => sum + (v.total_views || 0), 0) || 0;
  const totalWatchHours = videos?.reduce((sum, v) => sum + (v.watch_hours || 0), 0) || 0;
  const totalSubscribersGained = videos?.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0) || 0;
  const avgCTR = videos?.length 
    ? videos.reduce((sum, v) => sum + (v.click_rate || 0), 0) / videos.length 
    : 0;

  // Twitter metrics
  const twitterTotalImpressions = twitterMetrics?.reduce((sum, m) => sum + (m.views || 0), 0) || 0;
  const twitterTotalLikes = twitterMetrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
  const twitterNewFollowers = twitterMetrics?.reduce((sum, m) => sum + (m.subscribers || 0), 0) || 0;

  const isLoading = isLoadingInstagram;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 sm:h-32" />)}
        </div>
        <Skeleton className="h-[250px] sm:h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Channel Tabs */}
      <Tabs value={activeChannel} onValueChange={setActiveChannel}>
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList className="bg-muted/50 inline-flex min-w-max">
            {channels.map((channel) => (
              <TabsTrigger key={channel.id} value={channel.id} className="gap-1.5 sm:gap-2 px-2.5 sm:px-4 text-xs sm:text-sm">
                <channel.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{channel.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview - Full Dashboard */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <PerformanceOverview clientId={clientId} clientName={client.name} />
        </TabsContent>

        {/* Instagram - Full Dashboard */}
        <TabsContent value="instagram" className="mt-4">
          <InstagramDashboard
            clientId={clientId}
            posts={instagramPosts || []}
            metrics={instagramMetrics || []}
            isLoadingPosts={isLoadingInstagramPosts}
            isLoadingMetrics={isLoadingInstagram}
          />
        </TabsContent>

        {/* YouTube */}
        <TabsContent value="youtube" className="space-y-4 mt-4">
          {/* Connection & Import Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <YouTubeConnectionCard clientId={clientId} />
            <YouTubeCSVUpload clientId={clientId} />
          </div>

          {/* KPIs */}
          {videos && videos.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <EnhancedKPICard
                  title="Total Views"
                  value={totalViews}
                  icon={Eye}
                />
                <EnhancedKPICard
                  title="Watch Hours"
                  value={totalWatchHours}
                  icon={TrendingUp}
                  formatter={(v) => v.toLocaleString()}
                />
                <EnhancedKPICard
                  title="Subs Ganhos"
                  value={totalSubscribersGained}
                  icon={Users}
                />
                <EnhancedKPICard
                  title="CTR Médio"
                  value={avgCTR}
                  icon={BarChart3}
                  formatter={(v) => `${v.toFixed(1)}%`}
                />
              </div>

              {/* Videos Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm sm:text-base">Todos os Vídeos</CardTitle>
                </CardHeader>
                <CardContent>
                  <YouTubeVideosTable 
                    videos={videos} 
                    isLoading={isLoadingVideos}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Twitter */}
        <TabsContent value="twitter" className="space-y-4 mt-4">
          {/* Connection & Import Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <TwitterConnectionCard clientId={clientId} />
            <TwitterCSVUpload clientId={clientId} />
          </div>

          {/* Show KPIs if we have data */}
          {twitterMetrics && twitterMetrics.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <EnhancedKPICard
                title="Impressões"
                value={twitterTotalImpressions}
                icon={Eye}
              />
              <EnhancedKPICard
                title="Curtidas"
                value={twitterTotalLikes}
                icon={TrendingUp}
              />
              <EnhancedKPICard
                title="Novos Seguidores"
                value={twitterNewFollowers}
                icon={Users}
              />
              <EnhancedKPICard
                title="Dias de Dados"
                value={twitterMetrics.length}
                icon={BarChart3}
              />
            </div>
          )}
        </TabsContent>

        {/* Newsletter */}
        <TabsContent value="newsletter" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Configure sua integração de newsletter para ver métricas</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};