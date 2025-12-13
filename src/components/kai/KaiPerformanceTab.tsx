import { useState } from "react";
import { BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { EnhancedKPICard } from "@/components/performance/EnhancedKPICard";
import { YouTubeConnectionCard } from "@/components/performance/YouTubeConnectionCard";
import { TwitterConnectionCard } from "@/components/performance/TwitterConnectionCard";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface KaiPerformanceTabProps {
  clientId: string;
  client: Client;
}

const channels = [
  { id: "overview", label: "Visão Geral", icon: BarChart3 },
  { id: "youtube", label: "YouTube", icon: Eye },
  { id: "instagram", label: "Instagram", icon: Heart },
  { id: "twitter", label: "X/Twitter", icon: MessageCircle },
  { id: "newsletter", label: "Newsletter", icon: Users },
];

export const KaiPerformanceTab = ({ clientId, client }: KaiPerformanceTabProps) => {
  const [activeChannel, setActiveChannel] = useState("overview");
  
  const { data: youtubeMetrics, isLoading: isLoadingYouTube } = usePerformanceMetrics(clientId, "youtube", 30);
  const { data: videos } = useYouTubeVideos(clientId, 10);

  // Calculate aggregated metrics
  const totalViews = youtubeMetrics?.reduce((sum, m) => sum + (m.views || 0), 0) || 0;
  const totalLikes = youtubeMetrics?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
  const totalSubscribers = youtubeMetrics?.[0]?.subscribers || 0;
  const avgEngagement = youtubeMetrics?.length 
    ? youtubeMetrics.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / youtubeMetrics.length 
    : 0;

  // Prepare chart data
  const chartData = youtubeMetrics?.slice(0, 30).reverse().map(m => ({
    date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    views: m.views || 0,
    likes: m.likes || 0,
    engagement: m.engagement_rate || 0,
  })) || [];

  if (isLoadingYouTube) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Channel Tabs */}
      <Tabs value={activeChannel} onValueChange={setActiveChannel}>
        <TabsList className="bg-muted/50">
          {channels.map((channel) => (
            <TabsTrigger key={channel.id} value={channel.id} className="gap-2">
              <channel.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{channel.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <EnhancedKPICard
              title="Visualizações"
              value={totalViews}
              icon={Eye}
              change={12}
            />
            <EnhancedKPICard
              title="Curtidas"
              value={totalLikes}
              icon={Heart}
              change={8}
            />
            <EnhancedKPICard
              title="Seguidores"
              value={totalSubscribers}
              icon={Users}
              change={5}
            />
            <EnhancedKPICard
              title="Engajamento"
              value={Math.round(avgEngagement * 100) / 100}
              icon={TrendingUp}
              change={-2}
              formatter={(v) => `${v.toFixed(1)}%`}
            />
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="views" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorViews)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados históricos disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* YouTube */}
        <TabsContent value="youtube" className="space-y-4">
          <YouTubeConnectionCard clientId={clientId} />
          
          {videos && videos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vídeos Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {videos.slice(0, 10).map(v => (
                    <div key={v.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <span className="text-sm truncate flex-1">{v.title}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {(v.total_views || 0).toLocaleString()} views
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Instagram */}
        <TabsContent value="instagram" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Conecte sua conta do Instagram para ver métricas</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Twitter */}
        <TabsContent value="twitter" className="space-y-4">
          <TwitterConnectionCard clientId={clientId} />
        </TabsContent>

        {/* Newsletter */}
        <TabsContent value="newsletter" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configure sua integração de newsletter para ver métricas</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
