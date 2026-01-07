import { useState } from "react";
import { Eye, Instagram, Mail, Twitter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { useTwitterPosts } from "@/hooks/useTwitterMetrics";
import { InstagramDashboard } from "@/components/performance/InstagramDashboard";
import { YouTubeDashboard } from "@/components/performance/YouTubeDashboard";
import { NewsletterDashboard } from "@/components/performance/NewsletterDashboard";
import { TwitterDashboard } from "@/components/performance/TwitterDashboard";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";

interface KaiPerformanceTabProps {
  clientId: string;
  client: Client;
}

const allChannels = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Eye },
  { id: "twitter", label: "Twitter/X", icon: Twitter },
  { id: "newsletter", label: "Newsletter", icon: Mail },
];

export const KaiPerformanceTab = ({ clientId, client }: KaiPerformanceTabProps) => {
  // Get archived channels from client social_media settings
  const archivedChannels = (client.social_media as any)?.archived_channels || [];
  
  // Filter out archived channels
  const channels = allChannels.filter(
    channel => !archivedChannels.includes(channel.id)
  );
  
  const [activeChannel, setActiveChannel] = useState("instagram");
  
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 365);
  const { data: instagramPosts, isLoading: isLoadingInstagramPosts } = useInstagramPosts(clientId, 500);
  const { data: videos, isLoading: isLoadingVideos } = useYouTubeVideos(clientId, 100);
  const { data: newsletterMetrics, isLoading: isLoadingNewsletter } = usePerformanceMetrics(clientId, "newsletter", 365);
  const { data: twitterPosts, isLoading: isLoadingTwitter } = useTwitterPosts(clientId, 500);

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

        {/* Twitter/X - Full Dashboard */}
        <TabsContent value="twitter" className="mt-4">
          <TwitterDashboard
            clientId={clientId}
            posts={twitterPosts || []}
            isLoading={isLoadingTwitter}
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
