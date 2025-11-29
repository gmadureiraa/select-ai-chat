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

    // Fetch publication data from Beehiiv
    const publicationResponse = await fetch('https://api.beehiiv.com/v2/publications', {
      headers: {
        'Authorization': `Bearer ${beehiivApiKey}`,
        'Content-Type': 'application/json',
      },
    });

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

    // Fetch stats for the publication
    const statsResponse = await fetch(
      `https://api.beehiiv.com/v2/publications/${publication.id}/stats/summary`,
      {
        headers: {
          'Authorization': `Bearer ${beehiivApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!statsResponse.ok) {
      const error = await statsResponse.text();
      console.error('Beehiiv stats API error:', error);
      throw new Error(`Beehiiv stats API error: ${statsResponse.status}`);
    }

    const stats = await statsResponse.json();
    console.log('Stats fetched:', stats);

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store metrics in database
    const { data: metricsData, error: metricsError } = await supabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'newsletter',
        metric_date: new Date().toISOString().split('T')[0],
        subscribers: stats.data?.total_subscribers || 0,
        open_rate: stats.data?.average_open_rate || 0,
        click_rate: stats.data?.average_click_rate || 0,
        total_posts: stats.data?.total_posts || 0,
        metadata: {
          publication_name: publication.name,
          publication_id: publication.id,
          raw_stats: stats.data,
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
          subscribers: stats.data?.total_subscribers || 0,
          openRate: stats.data?.average_open_rate || 0,
          clickRate: stats.data?.average_click_rate || 0,
          totalPosts: stats.data?.total_posts || 0,
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
