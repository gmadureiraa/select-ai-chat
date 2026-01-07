import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, channelId } = await req.json();

    if (!clientId || !channelId) {
      return new Response(
        JSON.stringify({ error: 'clientId and channelId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    if (!YOUTUBE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'YOUTUBE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Fetching YouTube metrics for channel: ${channelId}`);

    // 1. Fetch channel statistics
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channel = channelData.items[0];
    const channelStats = channel.statistics;

    console.log(`Channel stats: ${JSON.stringify(channelStats)}`);

    // 2. Fetch recent videos from uploads playlist
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || 
      `UU${channelId.substring(2)}`; // Convert channel ID to uploads playlist ID

    // Get video list
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`
    );
    const playlistData = await playlistResponse.json();

    if (!playlistData.items) {
      console.log('No videos found in playlist');
      return new Response(
        JSON.stringify({ 
          message: 'Channel metrics updated, no videos found',
          channelStats 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video IDs
    const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId);

    // 3. Fetch detailed video statistics
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`
    );
    const videosData = await videosResponse.json();

    console.log(`Fetched ${videosData.items?.length || 0} videos`);

    // 4. Process and store video data
    const videos = videosData.items?.map((video: any) => {
      // Parse duration from ISO 8601 format (PT1H2M3S)
      const duration = video.contentDetails.duration;
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const hours = parseInt(match?.[1] || '0');
      const minutes = parseInt(match?.[2] || '0');
      const seconds = parseInt(match?.[3] || '0');
      const durationSeconds = hours * 3600 + minutes * 60 + seconds;

      return {
        client_id: clientId,
        video_id: video.id,
        title: video.snippet.title,
        published_at: video.snippet.publishedAt,
        duration_seconds: durationSeconds,
        total_views: parseInt(video.statistics.viewCount || '0'),
        watch_hours: 0, // Not available via public API
        subscribers_gained: 0, // Not available via public API
        impressions: 0, // Not available via public API
        click_rate: 0, // Not available via public API
        thumbnail_url: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        metadata: {
          likes: parseInt(video.statistics.likeCount || '0'),
          comments: parseInt(video.statistics.commentCount || '0'),
          description: video.snippet.description?.substring(0, 500),
        }
      };
    }) || [];

    // Upsert videos
    if (videos.length > 0) {
      const { error: videosError } = await supabase
        .from('youtube_videos')
        .upsert(videos, { onConflict: 'client_id,video_id' });
      
      if (videosError) {
        console.error('Error upserting videos:', videosError);
        throw videosError;
      }
    }

    // 5. Store channel metrics in platform_metrics
    const today = new Date().toISOString().split('T')[0];
    const { error: metricsError } = await supabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'youtube',
        metric_date: today,
        subscribers: parseInt(channelStats.subscriberCount || '0'),
        views: parseInt(channelStats.viewCount || '0'),
        total_posts: parseInt(channelStats.videoCount || '0'),
        metadata: {
          channel_id: channelId,
          channel_title: channel.snippet.title,
        }
      }, { onConflict: 'client_id,platform,metric_date' });

    if (metricsError) {
      console.error('Error upserting platform metrics:', metricsError);
      throw metricsError;
    }

    console.log(`Successfully updated YouTube metrics for client: ${clientId}`);

    return new Response(
      JSON.stringify({
        success: true,
        videosUpdated: videos.length,
        channelStats: {
          subscribers: channelStats.subscriberCount,
          totalViews: channelStats.viewCount,
          videoCount: channelStats.videoCount,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching YouTube metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
