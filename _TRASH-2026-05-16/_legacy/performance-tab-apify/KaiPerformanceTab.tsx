import { useState, lazy, Suspense } from "react";
import { Eye, Instagram, Mail, Twitter, Megaphone, Linkedin, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { useTwitterPosts } from "@/hooks/useTwitterMetrics";
import { useLinkedInPosts } from "@/hooks/useLinkedInPosts";
import type { Client } from "@/hooks/useClients";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricoolBestTimesCard } from "@/components/metricool/MetricoolBestTimesCard";
import { PlatformSyncButton, type SyncPlatform } from "@/components/performance/PlatformSyncButton";

// Lazy-load dos dashboards de cada canal — eles puxam recharts (chart-vendor) e
// componentes pesados (tabelas, modals). Só carrega o canal que o user abrir.
const InstagramDashboard = lazy(() =>
  import("@/components/performance/InstagramDashboard").then((m) => ({
    default: m.InstagramDashboard,
  })),
);
const YouTubeDashboard = lazy(() =>
  import("@/components/performance/YouTubeDashboard").then((m) => ({
    default: m.YouTubeDashboard,
  })),
);
const NewsletterDashboard = lazy(() =>
  import("@/components/performance/NewsletterDashboard").then((m) => ({
    default: m.NewsletterDashboard,
  })),
);
const TwitterDashboard = lazy(() =>
  import("@/components/performance/TwitterDashboard").then((m) => ({
    default: m.TwitterDashboard,
  })),
);
const LinkedInDashboard = lazy(() =>
  import("@/components/performance/LinkedInDashboard").then((m) => ({
    default: m.LinkedInDashboard,
  })),
);
const MetaAdsDashboard = lazy(() =>
  import("@/components/performance/MetaAdsDashboard").then((m) => ({
    default: m.MetaAdsDashboard,
  })),
);

function ChannelLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

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

  // Mapeia a aba ativa para a plataforma de sync (quando suportada).
  const SYNC_PLATFORM_MAP: Record<string, SyncPlatform | undefined> = {
    instagram: "instagram",
    youtube: "youtube",
    twitter: "twitter",
    linkedin: "linkedin",
  };
  const syncPlatform = SYNC_PLATFORM_MAP[activeChannel];
  
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
      {/* Eyebrow */}
      <div>
        <span className="kai-eyebrow">Performance</span>
      </div>
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
          {syncPlatform && (
            <PlatformSyncButton
              platform={syncPlatform}
              clientId={clientId}
              className="shrink-0"
            />
          )}
        </div>

        {/* Best Times Metricool — heatmap por plataforma sempre visível acima dos canais */}
        <div className="mt-4">
          <MetricoolBestTimesCard clientId={clientId} />
        </div>

        <TabsContent value="instagram" className="mt-4">
          <Suspense fallback={<ChannelLoader />}>
            <InstagramDashboard
              clientId={clientId}
              posts={instagramPosts || []}
              metrics={instagramMetrics || []}
              isLoadingPosts={isLoadingInstagramPosts}
              isLoadingMetrics={isLoadingInstagram}
            />
          </Suspense>
        </TabsContent>

        {/* YouTube - Full Dashboard */}
        <TabsContent value="youtube" className="mt-4">
          <Suspense fallback={<ChannelLoader />}>
            <YouTubeDashboard
              clientId={clientId}
              videos={videos || []}
              isLoading={isLoadingVideos}
            />
          </Suspense>
        </TabsContent>

        {/* Twitter/X - Full Dashboard */}
        <TabsContent value="twitter" className="mt-4">
          <Suspense fallback={<ChannelLoader />}>
            <TwitterDashboard
              clientId={clientId}
              posts={twitterPosts || []}
              isLoading={isLoadingTwitter}
            />
          </Suspense>
        </TabsContent>

        {/* LinkedIn - Full Dashboard */}
        <TabsContent value="linkedin" className="mt-4">
          <Suspense fallback={<ChannelLoader />}>
            <LinkedInDashboard
              clientId={clientId}
              posts={linkedInPosts || []}
              isLoading={isLoadingLinkedIn}
            />
          </Suspense>
        </TabsContent>

        {/* Newsletter - Full Dashboard */}
        <TabsContent value="newsletter" className="mt-4">
          <Suspense fallback={<ChannelLoader />}>
            <NewsletterDashboard
              clientId={clientId}
              metrics={newsletterMetrics || []}
              isLoading={isLoadingNewsletter}
            />
          </Suspense>
        </TabsContent>

        {/* Meta Ads - Full Dashboard */}
        <TabsContent value="meta_ads" className="mt-4">
          <Suspense fallback={<ChannelLoader />}>
            <MetaAdsDashboard clientId={clientId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};
