import { useState } from "react";
import { BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle, Instagram, Twitter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { EnhancedKPICard } from "@/components/performance/EnhancedKPICard";
import { YouTubeConnectionCard } from "@/components/performance/YouTubeConnectionCard";
import { TwitterConnectionCard } from "@/components/performance/TwitterConnectionCard";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  
  const { data: youtubeMetrics, isLoading: isLoadingYouTube } = usePerformanceMetrics(clientId, "youtube", 30);
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 30);
  const { data: videos } = useYouTubeVideos(clientId, 10);

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

  // YouTube metrics
  const totalViews = youtubeMetrics?.reduce((sum, m) => sum + (m.views || 0), 0) || 0;
  const totalYTLikes = youtubeMetrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
  const totalSubscribers = youtubeMetrics?.[0]?.subscribers || 0;
  const avgEngagement = youtubeMetrics?.length 
    ? youtubeMetrics.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / youtubeMetrics.length 
    : 0;

  // Instagram chart data
  const instagramChartData = instagramMetrics?.slice(0, 14).reverse().map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    followers: m.subscribers || 0,
    likes: m.likes || 0,
    engagement: m.engagement_rate || 0,
  })) || [];

  // YouTube chart data
  const youtubeChartData = youtubeMetrics?.slice(0, 30).reverse().map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    views: m.views || 0,
    likes: m.likes || 0,
    engagement: m.engagement_rate || 0,
  })) || [];

  const isLoading = isLoadingYouTube || isLoadingInstagram;

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

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* KPIs - Instagram focused */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <EnhancedKPICard
              title="Seguidores"
              value={instagramFollowers}
              icon={Users}
              change={followersChange}
            />
            <EnhancedKPICard
              title="Curtidas"
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

          {/* Recent Posts from metadata */}
          {latestInstagram?.metadata?.recent_posts && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm sm:text-base flex items-center justify-between">
                  Posts Recentes
                  <Badge variant="outline" className="text-[10px]">Instagram</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(latestInstagram.metadata.recent_posts as any[]).slice(0, 5).map((post: any, index: number) => (
                  <div key={post.id || index} className="flex items-start justify-between gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 flex-1">
                      {post.caption?.substring(0, 100)}...
                    </p>
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {post.likes?.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {post.comments}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Histórico de Seguidores</CardTitle>
            </CardHeader>
            <CardContent>
              {instagramChartData.length > 0 ? (
                <div className="h-[200px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={instagramChartData}>
                      <defs>
                        <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="followers" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorFollowers)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] sm:h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados históricos disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instagram */}
        <TabsContent value="instagram" className="space-y-4 mt-4">
          {instagramMetrics && instagramMetrics.length > 0 ? (
            <>
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
                  title="Taxa de Engajamento"
                  value={instagramEngagement}
                  icon={TrendingUp}
                  formatter={(v) => `${v.toFixed(2)}%`}
                />
              </div>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm sm:text-base">Evolução de Seguidores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={instagramChartData}>
                        <defs>
                          <linearGradient id="colorIG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="followers" 
                          stroke="hsl(var(--primary))" 
                          fillOpacity={1} 
                          fill="url(#colorIG)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Instagram className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Conecte sua conta do Instagram para ver métricas</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* YouTube */}
        <TabsContent value="youtube" className="space-y-4 mt-4">
          <YouTubeConnectionCard clientId={clientId} />
          
          {videos && videos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm sm:text-base">Vídeos Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {videos.slice(0, 10).map(v => (
                    <div key={v.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg gap-3">
                      <span className="text-xs sm:text-sm truncate flex-1">{v.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(v.total_views || 0).toLocaleString()} views
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
