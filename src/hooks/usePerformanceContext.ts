import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PerformanceContextData {
  instagram: {
    followers: number;
    avgEngagement: number;
    totalPosts: number;
    topPosts: Array<{ caption: string; likes: number; engagement: number }>;
  };
  youtube: {
    subscribers: number;
    totalViews: number;
    watchHours: number;
    topVideos: Array<{ title: string; views: number; ctr: number }>;
  };
  insights: string[];
}

export function usePerformanceContext(clientId: string) {
  return useQuery({
    queryKey: ["performance-context", clientId],
    queryFn: async (): Promise<PerformanceContextData> => {
      // Fetch Instagram metrics
      const { data: instagramMetrics } = await supabase
        .from("platform_metrics")
        .select("subscribers, engagement_rate, likes, comments")
        .eq("client_id", clientId)
        .eq("platform", "instagram")
        .order("metric_date", { ascending: false })
        .limit(30);

      // Fetch Instagram top posts
      const { data: instagramPosts } = await supabase
        .from("instagram_posts")
        .select("caption, likes, engagement_rate")
        .eq("client_id", clientId)
        .order("likes", { ascending: false })
        .limit(5);

      // Fetch YouTube videos
      const { data: youtubeVideos } = await supabase
        .from("youtube_videos")
        .select("title, total_views, watch_hours, click_rate, subscribers_gained")
        .eq("client_id", clientId)
        .order("total_views", { ascending: false })
        .limit(10);

      // Calculate Instagram stats
      const latestInstagram = instagramMetrics?.[0];
      const avgInstagramEngagement = instagramMetrics?.length
        ? instagramMetrics.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / instagramMetrics.length
        : 0;

      // Calculate YouTube stats
      const totalYoutubeViews = youtubeVideos?.reduce((sum, v) => sum + (v.total_views || 0), 0) || 0;
      const totalWatchHours = youtubeVideos?.reduce((sum, v) => sum + (v.watch_hours || 0), 0) || 0;
      const totalSubscribers = youtubeVideos?.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0) || 0;

      // Generate insights
      const insights: string[] = [];
      
      if (instagramPosts?.length) {
        const topPost = instagramPosts[0];
        if (topPost.likes && topPost.likes > 100) {
          insights.push(`Seu post com mais engajamento teve ${topPost.likes} curtidas`);
        }
      }

      if (youtubeVideos?.length) {
        const topVideo = youtubeVideos[0];
        if (topVideo.total_views && topVideo.total_views > 1000) {
          insights.push(`Seu vídeo "${topVideo.title?.slice(0, 40)}..." tem ${topVideo.total_views.toLocaleString()} views`);
        }
      }

      return {
        instagram: {
          followers: latestInstagram?.subscribers || 0,
          avgEngagement: avgInstagramEngagement,
          totalPosts: instagramPosts?.length || 0,
          topPosts: (instagramPosts || []).map(p => ({
            caption: p.caption || "",
            likes: p.likes || 0,
            engagement: p.engagement_rate || 0,
          })),
        },
        youtube: {
          subscribers: totalSubscribers,
          totalViews: totalYoutubeViews,
          watchHours: totalWatchHours,
          topVideos: (youtubeVideos || []).map(v => ({
            title: v.title,
            views: v.total_views || 0,
            ctr: v.click_rate || 0,
          })),
        },
        insights,
      };
    },
    enabled: !!clientId,
  });
}

export function formatPerformanceContextForPrompt(context: PerformanceContextData): string {
  const lines: string[] = ["## Métricas de Performance do Cliente\n"];

  lines.push("### Instagram");
  lines.push(`- Seguidores: ${context.instagram.followers.toLocaleString()}`);
  lines.push(`- Engajamento médio: ${context.instagram.avgEngagement.toFixed(2)}%`);
  lines.push(`- Total de posts analisados: ${context.instagram.totalPosts}`);
  
  if (context.instagram.topPosts.length > 0) {
    lines.push("\nTop Posts:");
    context.instagram.topPosts.slice(0, 3).forEach((post, i) => {
      lines.push(`${i + 1}. ${post.caption?.slice(0, 50) || "Sem legenda"}... (${post.likes} likes)`);
    });
  }

  lines.push("\n### YouTube");
  lines.push(`- Total de views: ${context.youtube.totalViews.toLocaleString()}`);
  lines.push(`- Horas assistidas: ${context.youtube.watchHours.toLocaleString()}`);
  lines.push(`- Subscribers ganhos: ${context.youtube.subscribers.toLocaleString()}`);

  if (context.youtube.topVideos.length > 0) {
    lines.push("\nTop Vídeos:");
    context.youtube.topVideos.slice(0, 3).forEach((video, i) => {
      lines.push(`${i + 1}. ${video.title?.slice(0, 50) || "Sem título"}... (${video.views.toLocaleString()} views)`);
    });
  }

  if (context.insights.length > 0) {
    lines.push("\n### Insights");
    context.insights.forEach(insight => {
      lines.push(`- ${insight}`);
    });
  }

  return lines.join("\n");
}
