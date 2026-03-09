import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // 1. Fetch channel statistics + contentDetails for uploads playlist
    // Support both channel ID (UC...) and handle/username (@...)
    let resolvedChannelId = channelId;
    
    // If it looks like a handle or username, resolve it first
    if (channelId.startsWith('@') || (!channelId.startsWith('UC') && !channelId.startsWith('HC'))) {
      const handleParam = channelId.startsWith('@') ? channelId : `@${channelId}`;
      console.log(`Resolving handle: ${handleParam}`);
      
      // Try forHandle first
      const handleResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handleParam}&key=${YOUTUBE_API_KEY}`
      );
      const handleData = await handleResponse.json();
      console.log(`Handle resolution response: ${JSON.stringify(handleData)}`);
      
      if (handleData.items && handleData.items.length > 0) {
        resolvedChannelId = handleData.items[0].id;
        console.log(`Resolved handle to channel ID: ${resolvedChannelId}`);
      } else {
        // Try forUsername as fallback
        const usernameResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${channelId.replace('@', '')}&key=${YOUTUBE_API_KEY}`
        );
        const usernameData = await usernameResponse.json();
        if (usernameData.items && usernameData.items.length > 0) {
          resolvedChannelId = usernameData.items[0].id;
          console.log(`Resolved username to channel ID: ${resolvedChannelId}`);
        }
      }
    }

    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id=${resolvedChannelId}&key=${YOUTUBE_API_KEY}`;
    console.log(`Fetching channel data from: ${channelUrl.replace(YOUTUBE_API_KEY, 'REDACTED')}`);
    
    const channelResponse = await fetch(channelUrl);
    const channelData = await channelResponse.json();
    
    console.log(`YouTube API response status: ${channelResponse.status}, items: ${channelData.items?.length || 0}`);
    
    if (channelData.error) {
      console.error(`YouTube API error: ${JSON.stringify(channelData.error)}`);
      return new Response(
        JSON.stringify({ error: `YouTube API error: ${channelData.error.message}`, details: channelData.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!channelData.items || channelData.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Channel not found', channelId: resolvedChannelId, originalInput: channelId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channel = channelData.items[0];
    const channelStats = channel.statistics;

    console.log(`Channel stats: ${JSON.stringify(channelStats)}`);

    // 2. Get uploads playlist ID from contentDetails
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || 
      `UU${channelId.substring(2)}`;

    console.log(`Uploads playlist ID: ${uploadsPlaylistId}`);

    // Get video list (paginate to get more videos)
    let allVideoIds: string[] = [];
    let nextPageToken: string | undefined;
    
    do {
      const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
      const playlistResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}${pageParam}`
      );
      const playlistData = await playlistResponse.json();

      if (!playlistData.items) break;
      
      allVideoIds.push(...playlistData.items.map((item: any) => item.contentDetails.videoId));
      nextPageToken = playlistData.nextPageToken;
    } while (nextPageToken && allVideoIds.length < 200);

    if (allVideoIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Channel metrics updated, no videos found', channelStats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${allVideoIds.length} video IDs`);

    // 3. Fetch detailed video statistics in batches of 50
    const allVideos: any[] = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50);
      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`
      );
      const videosData = await videosResponse.json();
      if (videosData.items) {
        allVideos.push(...videosData.items);
      }
    }

    console.log(`Fetched ${allVideos.length} videos with details`);

    // 4. Process and store video data
    const videos = allVideos.map((video: any) => {
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
        likes: parseInt(video.statistics.likeCount || '0'),
        comments: parseInt(video.statistics.commentCount || '0'),
        watch_hours: 0,
        subscribers_gained: 0,
        impressions: 0,
        click_rate: 0,
        thumbnail_url: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        metadata: {
          description: video.snippet.description?.substring(0, 500),
        }
      };
    });

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
