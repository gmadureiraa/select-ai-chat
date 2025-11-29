import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId } = await req.json();
    
    if (!clientId) {
      throw new Error('Client ID is required');
    }

    const beehiivApiKey = Deno.env.get('BEEHIIV_API_KEY');
    if (!beehiivApiKey) {
      throw new Error('Beehiiv API key not configured');
    }

    console.log('Fetching Beehiiv metrics for client:', clientId);

    // Fetch publication data with expanded stats from Beehiiv
    const publicationResponse = await fetch(
      'https://api.beehiiv.com/v2/publications?expand=stats',
      {
        headers: {
          'Authorization': `Bearer ${beehiivApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!publicationResponse.ok) {
      const error = await publicationResponse.text();
      console.error('Beehiiv API error:', error);
      throw new Error(`Beehiiv API error: ${publicationResponse.status}`);
    }

    const publications = await publicationResponse.json();
    console.log('Publications fetched with stats:', JSON.stringify(publications, null, 2));

    // Get the first publication (assuming single publication for now)
    const publication = publications.data?.[0];
    if (!publication) {
      throw new Error('No publication found');
    }

    // Extract metrics from publication stats
    const stats = publication.stats || {};
    const subscribers = stats.active_subscriptions || stats.stat_active_subscriptions || 0;
    const openRate = stats.average_open_rate || stats.stat_average_open_rate || 0;
    const clickRate = stats.average_click_rate || stats.stat_average_click_rate || 0;

    console.log('Extracted metrics:', {
      subscribers,
      openRate,
      clickRate,
    });

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch recent posts with their stats
    const postsResponse = await fetch(
      `https://api.beehiiv.com/v2/publications/${publication.id}/posts?status=confirmed&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${beehiivApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let posts: any[] = [];
    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      posts = postsData.data || [];
      console.log(`Fetched ${posts.length} posts`);
    } else {
      console.warn('Could not fetch posts:', postsResponse.status);
    }

    // Store metrics in database
    const { data: metricsData, error: metricsError } = await supabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'newsletter',
        metric_date: new Date().toISOString().split('T')[0],
        subscribers: subscribers,
        open_rate: parseFloat(openRate),
        click_rate: parseFloat(clickRate),
        total_posts: posts.length,
        metadata: {
          publication_name: publication.name,
          publication_id: publication.id,
          raw_stats: stats,
          recent_posts: posts.map(post => ({
            id: post.id,
            title: post.title,
            subtitle: post.subtitle,
            published_at: post.publish_date,
            delivered: post.stats?.delivered || 0,
            opened: post.stats?.unique_opens || 0,
            clicked: post.stats?.unique_clicks || 0,
            open_rate: post.stats?.unique_opens && post.stats?.delivered 
              ? ((post.stats.unique_opens / post.stats.delivered) * 100).toFixed(2)
              : 0,
            click_rate: post.stats?.unique_clicks && post.stats?.delivered
              ? ((post.stats.unique_clicks / post.stats.delivered) * 100).toFixed(2)
              : 0,
          })),
        },
      }, {
        onConflict: 'client_id,platform,metric_date',
      });

    if (metricsError) {
      console.error('Error storing metrics:', metricsError);
      throw metricsError;
    }

    console.log('Metrics stored successfully:', metricsData);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscribers: subscribers,
          openRate: parseFloat(openRate),
          clickRate: parseFloat(clickRate),
          totalPosts: posts.length,
          recentPosts: posts.map(post => ({
            id: post.id,
            title: post.title,
            subtitle: post.subtitle,
            published_at: post.publish_date,
            delivered: post.stats?.delivered || 0,
            opened: post.stats?.unique_opens || 0,
            clicked: post.stats?.unique_clicks || 0,
            open_rate: post.stats?.unique_opens && post.stats?.delivered 
              ? ((post.stats.unique_opens / post.stats.delivered) * 100).toFixed(2)
              : 0,
            click_rate: post.stats?.unique_clicks && post.stats?.delivered
              ? ((post.stats.unique_clicks / post.stats.delivered) * 100).toFixed(2)
              : 0,
          })),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in fetch-beehiiv-metrics:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
