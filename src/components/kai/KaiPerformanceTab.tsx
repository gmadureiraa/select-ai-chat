import { useState } from "react";
import { BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle, Instagram, Twitter, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { EnhancedKPICard } from "@/components/performance/EnhancedKPICard";
import { YouTubeConnectionCard } from "@/components/performance/YouTubeConnectionCard";
import { TwitterConnectionCard } from "@/components/performance/TwitterConnectionCard";
import { OverviewInsightsCard } from "@/components/performance/OverviewInsightsCard";
import { InstagramPostsTable } from "@/components/performance/InstagramPostsTable";
import { YouTubeVideosTable } from "@/components/performance/YouTubeVideosTable";
import { InstagramCSVUpload } from "@/components/performance/InstagramCSVUpload";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [showInstagramUpload, setShowInstagramUpload] = useState(false);
  
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 30);
  const { data: instagramPosts, isLoading: isLoadingInstagramPosts } = useInstagramPosts(clientId);
  const { data: videos, isLoading: isLoadingVideos } = useYouTubeVideos(clientId, 100);

  // Instagram aggregated metrics (from latest record)
  const latestInstagram = instagramMetrics?.[0];
  const previousInstagram = instagramMetrics?.[1];
  
  const instagramFollowers = latestInstagram?.subscribers || 0;
  const instagramLikes = latestInstagram?.likes || 0;
  const instagramComments = latestInstagram?.comments || 0;
  const instagramEngagement = latestInstagram?.engagement_rate || 0;

  // Calculate changes
  const followersChange = previousInstagram?.subscribers 
    ? Math.round(((instagramFollowers - previousInstagram.subscribers) / previousInstagram.subscribers) * 100)
    : 0;
  const likesChange = previousInstagram?.likes
    ? Math.round(((instagramLikes - previousInstagram.likes) / previousInstagram.likes) * 100)
    : 0;

  // YouTube metrics from videos
  const totalViews = videos?.reduce((sum, v) => sum + (v.total_views || 0), 0) || 0;
  const totalWatchHours = videos?.reduce((sum, v) => sum + (v.watch_hours || 0), 0) || 0;
  const totalSubscribersGained = videos?.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0) || 0;
  const avgCTR = videos?.length 
    ? videos.reduce((sum, v) => sum + (v.click_rate || 0), 0) / videos.length 
    : 0;

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

        {/* Overview - AI Insights */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <OverviewInsightsCard clientId={clientId} clientName={client.name} />
        </TabsContent>

        {/* Instagram */}
        <TabsContent value="instagram" className="space-y-4 mt-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <EnhancedKPICard
              title="Seguidores"
              value={instagramFollowers}
              icon={Users}
              change={followersChange}
            />
            <EnhancedKPICard
              title="Curtidas Totais"
              value={instagramLikes}
              icon={Heart}
              change={likesChange}
            />
            <EnhancedKPICard
              title="Comentários"
              value={instagramComments}
              icon={MessageCircle}
              change={0}
            />
            <EnhancedKPICard
              title="Engajamento"
              value={Math.round(instagramEngagement * 100) / 100}
              icon={TrendingUp}
              change={0}
              formatter={(v) => `${v.toFixed(2)}%`}
            />
          </div>

          {/* Upload Section */}
          <Collapsible open={showInstagramUpload} onOpenChange={setShowInstagramUpload}>
            <div className="flex justify-end">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  {showInstagramUpload ? "Ocultar Upload" : "Importar CSV"}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-4">
              <InstagramCSVUpload clientId={clientId} />
            </CollapsibleContent>
          </Collapsible>

          {/* Posts Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Todos os Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <InstagramPostsTable 
                posts={instagramPosts || []} 
                isLoading={isLoadingInstagramPosts}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* YouTube */}
        <TabsContent value="youtube" className="space-y-4 mt-4">
          {/* Connection Card */}
          <YouTubeConnectionCard clientId={clientId} />

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
          <TwitterConnectionCard clientId={clientId} />
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
