import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    console.error('Failed to refresh token:', await response.text());
    return null;
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create user-scoped client to get user ID
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get stored tokens using service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('youtube_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'YouTube not connected', needsAuth: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = tokenData.access_token;
    
    // Check if token is expired and refresh if needed
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      if (!tokenData.refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Token expired, please reconnect', needsAuth: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Refreshing expired token...');
      const newTokens = await refreshAccessToken(tokenData.refresh_token);
      
      if (!newTokens) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token, please reconnect', needsAuth: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessToken = newTokens.access_token;
      
      // Update stored token
      await supabase
        .from('youtube_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tokenData.id);
    }

    const channelId = tokenData.channel_id;
    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'No channel associated with this connection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching analytics for channel: ${channelId}`);

    // Fetch channel statistics using Data API
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error('Channel API error:', errorText);
      throw new Error('Failed to fetch channel data');
    }

    const channelData = await channelResponse.json();
    const channel = channelData.items?.[0];
    
    if (!channel) {
      throw new Error('Channel not found');
    }

    const stats = channel.statistics;

    // Fetch YouTube Analytics data (last 30 days)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const analyticsResponse = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments&dimensions=day&sort=day`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    let dailyMetrics: any[] = [];
    
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      dailyMetrics = analyticsData.rows || [];
      console.log(`Fetched ${dailyMetrics.length} days of analytics`);
    } else {
      console.error('Analytics API error:', await analyticsResponse.text());
    }

    // Store daily metrics
    for (const row of dailyMetrics) {
      const [date, views, watchMinutes, subsGained, subsLost, likes, comments] = row;
      
      const { error: upsertError } = await supabase
        .from('platform_metrics')
        .upsert({
          client_id: clientId,
          platform: 'youtube',
          metric_date: date,
          views: views,
          metadata: {
            watch_minutes: watchMinutes,
            watch_hours: Math.round(watchMinutes / 60 * 10) / 10,
            subscribers_gained: subsGained,
            subscribers_lost: subsLost,
            daily_gain: subsGained - subsLost,
            likes: likes,
            comments: comments,
          }
        }, { onConflict: 'client_id,platform,metric_date' });

      if (upsertError) {
        console.error('Error upserting metric:', upsertError);
      }
    }

    // Update today's subscriber count
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'youtube',
        metric_date: today,
        subscribers: parseInt(stats.subscriberCount || '0'),
        total_posts: parseInt(stats.videoCount || '0'),
        metadata: {
          channel_id: channelId,
          channel_title: channel.snippet.title,
          total_views: parseInt(stats.viewCount || '0'),
        }
      }, { onConflict: 'client_id,platform,metric_date' });

    // Fetch recent videos with their stats
    const uploadsPlaylistId = `UU${channelId.substring(2)}`;
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (videosResponse.ok) {
      const playlistData = await videosResponse.json();
      const videoIds = playlistData.items?.map((item: any) => item.contentDetails.videoId) || [];

      if (videoIds.length > 0) {
        const videoStatsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(',')}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (videoStatsResponse.ok) {
          const videoStatsData = await videoStatsResponse.json();
          
          const videos = videoStatsData.items?.map((video: any) => {
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
              thumbnail_url: video.snippet.thumbnails?.high?.url,
              metadata: {
                likes: parseInt(video.statistics.likeCount || '0'),
                comments: parseInt(video.statistics.commentCount || '0'),
              }
            };
          }) || [];

          if (videos.length > 0) {
            await supabase
              .from('youtube_videos')
              .upsert(videos, { onConflict: 'client_id,video_id' });
          }
          
          console.log(`Updated ${videos.length} videos`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        daysUpdated: dailyMetrics.length,
        channelStats: {
          subscribers: stats.subscriberCount,
          totalViews: stats.viewCount,
          videoCount: stats.videoCount,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching YouTube analytics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
