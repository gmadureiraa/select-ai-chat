import { useState } from "react";
import { Eye, Instagram, Mail, BarChart3, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { InstagramDashboard } from "@/components/performance/InstagramDashboard";
import { YouTubeDashboard } from "@/components/performance/YouTubeDashboard";
import { NewsletterDashboard } from "@/components/performance/NewsletterDashboard";
import { ClientViewDashboard } from "@/components/performance/ClientViewDashboard";
import { FullAnalysisDashboard } from "@/components/performance/FullAnalysisDashboard";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";

interface KaiPerformanceTabProps {
  clientId: string;
  client: Client;
}

const allChannels = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Eye },
  { id: "newsletter", label: "Newsletter", icon: Mail },
];

export const KaiPerformanceTab = ({ clientId, client }: KaiPerformanceTabProps) => {
  // Get archived channels from client social_media settings
  const archivedChannels = (client.social_media as any)?.archived_channels || [];
  
  // Filter out archived channels
  const channels = allChannels.filter(
    channel => !archivedChannels.includes(channel.id)
  );
  
  const [viewMode, setViewMode] = useState<"client-view" | "full-analysis">("client-view");
  const [activeChannel, setActiveChannel] = useState("instagram");
  
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 365);
  const { data: instagramPosts, isLoading: isLoadingInstagramPosts } = useInstagramPosts(clientId, 500);
  const { data: videos, isLoading: isLoadingVideos } = useYouTubeVideos(clientId, 100);
  const { data: newsletterMetrics, isLoading: isLoadingNewsletter } = usePerformanceMetrics(clientId, "newsletter", 365);

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
      {/* Top Level View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "client-view" | "full-analysis")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="client-view" className="gap-1.5 px-4 text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Visão do Cliente</span>
              <span className="sm:hidden">Cliente</span>
            </TabsTrigger>
            <TabsTrigger value="full-analysis" className="gap-1.5 px-4 text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Análise Completa</span>
              <span className="sm:hidden">Análise</span>
            </TabsTrigger>
          </TabsList>

          {/* Channel Selector */}
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <div className="inline-flex bg-muted/30 rounded-lg p-1 min-w-max">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannel(channel.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    activeChannel === channel.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <channel.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>{channel.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Client View - Simplified Dashboard */}
        <TabsContent value="client-view" className="mt-0">
          <ClientViewDashboard
            clientId={clientId}
            client={client}
            platform={activeChannel}
          />
        </TabsContent>

        {/* Full Analysis - Detailed Dashboard */}
        <TabsContent value="full-analysis" className="mt-0">
          <FullAnalysisDashboard
            clientId={clientId}
            client={client}
            platform={activeChannel}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
