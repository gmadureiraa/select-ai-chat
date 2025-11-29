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
    console.log('Publications fetched:', publications);

    // Get the first publication (assuming single publication for now)
    const publication = publications.data?.[0];
    if (!publication) {
      throw new Error('No publication found');
    }

    // Fetch aggregate stats for posts
    const statsResponse = await fetch(
      `https://api.beehiiv.com/v2/publications/${publication.id}/posts/stats`,
      {
        headers: {
          'Authorization': `Bearer ${beehiivApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!statsResponse.ok) {
      const error = await statsResponse.text();
      console.error('Beehiiv aggregate stats API error:', error);
      throw new Error(`Beehiiv aggregate stats API error: ${statsResponse.status}`);
    }

    const aggregateStats = await statsResponse.json();
    console.log('Aggregate stats fetched:', aggregateStats);

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract metrics from the response
    const statsData = aggregateStats.data || {};
    const subscribers = publication.stats?.active_subscriptions || 0;
    const totalPosts = statsData.total_posts || 0;
    
    // Calculate averages from aggregate stats
    const uniqueOpens = statsData.unique_opens || 0;
    const uniqueClicks = statsData.unique_clicks || 0;
    const sent = statsData.sent || 1; // Avoid division by zero
    
    const openRate = sent > 0 ? ((uniqueOpens / sent) * 100).toFixed(2) : 0;
    const clickRate = sent > 0 ? ((uniqueClicks / sent) * 100).toFixed(2) : 0;

    console.log('Calculated metrics:', {
      subscribers,
      openRate,
      clickRate,
      totalPosts,
    });

    // Store metrics in database
    const { data: metricsData, error: metricsError } = await supabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'newsletter',
        metric_date: new Date().toISOString().split('T')[0],
        subscribers: subscribers,
        open_rate: parseFloat(openRate as string),
        click_rate: parseFloat(clickRate as string),
        total_posts: totalPosts,
        metadata: {
          publication_name: publication.name,
          publication_id: publication.id,
          raw_publication_stats: publication.stats,
          raw_aggregate_stats: statsData,
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
          openRate: parseFloat(openRate as string),
          clickRate: parseFloat(clickRate as string),
          totalPosts: totalPosts,
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
