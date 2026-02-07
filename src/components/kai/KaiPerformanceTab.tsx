import { useState } from "react";
import { Eye, Instagram, Mail, Twitter, Megaphone, Linkedin, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { useTwitterPosts } from "@/hooks/useTwitterMetrics";
import { useLinkedInPosts } from "@/hooks/useLinkedInPosts";
import { InstagramDashboard } from "@/components/performance/InstagramDashboard";
import { YouTubeDashboard } from "@/components/performance/YouTubeDashboard";
import { NewsletterDashboard } from "@/components/performance/NewsletterDashboard";
import { TwitterDashboard } from "@/components/performance/TwitterDashboard";
import { LinkedInDashboard } from "@/components/performance/LinkedInDashboard";
import { MetaAdsDashboard } from "@/components/performance/MetaAdsDashboard";
import { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSyncLateMetrics } from "@/hooks/useSyncLateMetrics";
import { cn } from "@/lib/utils";

interface KaiPerformanceTabProps {
  clientId: string;
  client: Client;
}

const allChannels = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Eye },
  { id: "twitter", label: "Twitter/X", icon: Twitter },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "newsletter", label: "Newsletter", icon: Mail },
  { id: "meta_ads", label: "Meta Ads", icon: Megaphone },
];

export const KaiPerformanceTab = ({ clientId, client }: KaiPerformanceTabProps) => {
  // Get archived channels from client social_media settings
  const archivedChannels = (client.social_media as any)?.archived_channels || [];
  
  // Filter out archived channels
  const channels = allChannels.filter(
    channel => !archivedChannels.includes(channel.id)
  );
  
  const [activeChannel, setActiveChannel] = useState("instagram");
  const { syncMetrics, isSyncing } = useSyncLateMetrics(clientId);
  
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 365);
  const { data: instagramPosts, isLoading: isLoadingInstagramPosts } = useInstagramPosts(clientId, 500);
  const { data: videos, isLoading: isLoadingVideos } = useYouTubeVideos(clientId, 100);
  const { data: newsletterMetrics, isLoading: isLoadingNewsletter } = usePerformanceMetrics(clientId, "newsletter", 365);
  const { data: twitterPosts, isLoading: isLoadingTwitter } = useTwitterPosts(clientId, 500);
  const { data: linkedInPosts, isLoading: isLoadingLinkedIn } = useLinkedInPosts(clientId, 500);

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
        <div className="flex items-center justify-between gap-4 -mx-3 sm:mx-0 px-3 sm:px-0">
          <div className="overflow-x-auto">
            <TabsList className="bg-muted/50 inline-flex min-w-max">
              {channels.map((channel) => (
                <TabsTrigger key={channel.id} value={channel.id} className="gap-1.5 sm:gap-2 px-2.5 sm:px-4 text-xs sm:text-sm">
                  <channel.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>{channel.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={syncMetrics} 
            disabled={isSyncing}
            className="shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
            Sincronizar
          </Button>
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

        {/* LinkedIn - Full Dashboard */}
        <TabsContent value="linkedin" className="mt-4">
          <LinkedInDashboard
            clientId={clientId}
            posts={linkedInPosts || []}
            isLoading={isLoadingLinkedIn}
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

        {/* Meta Ads - Full Dashboard */}
        <TabsContent value="meta_ads" className="mt-4">
          <MetaAdsDashboard clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
