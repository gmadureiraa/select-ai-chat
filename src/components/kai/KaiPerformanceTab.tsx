import { useState } from "react";
import { BarChart3, Eye, Instagram, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { PerformanceOverview } from "@/components/performance/PerformanceOverview";
import { InstagramDashboard } from "@/components/performance/InstagramDashboard";
import { YouTubeDashboard } from "@/components/performance/YouTubeDashboard";
import { NewsletterDashboard } from "@/components/performance/NewsletterDashboard";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";

interface KaiPerformanceTabProps {
  clientId: string;
  client: Client;
}

const allChannels = [
  { id: "overview", label: "Geral", icon: BarChart3 },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Eye },
  { id: "newsletter", label: "Newsletter", icon: Mail },
];

export const KaiPerformanceTab = ({ clientId, client }: KaiPerformanceTabProps) => {
  // Get archived channels from client social_media settings
  const archivedChannels = (client.social_media as any)?.archived_channels || [];
  
  // Filter out archived channels (overview is always visible)
  const channels = allChannels.filter(
    channel => channel.id === "overview" || !archivedChannels.includes(channel.id)
  );
  
  const [activeChannel, setActiveChannel] = useState("overview");
  
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

        {/* YouTube - Full Dashboard */}
        <TabsContent value="youtube" className="mt-4">
          <YouTubeDashboard
            clientId={clientId}
            videos={videos || []}
            isLoading={isLoadingVideos}
          />
        </TabsContent>

        {/* Newsletter - Full Dashboard */}
        <TabsContent value="newsletter" className="mt-4">
          <NewsletterDashboard
            clientId={clientId}
            metrics={newsletterMetrics || []}
            isLoading={isLoadingNewsletter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
