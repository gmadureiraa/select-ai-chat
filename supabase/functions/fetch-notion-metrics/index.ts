import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, databaseId } = await req.json();

    if (!clientId || !databaseId) {
      throw new Error('clientId and databaseId are required');
    }

    console.log(`Fetching Notion metrics for client: ${clientId}, database: ${databaseId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch data from Notion database
    // Note: This requires the Notion API integration to be set up
    // For now, we'll use placeholder logic that can be replaced with actual Notion API calls
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    
    if (!notionApiKey) {
      throw new Error('NOTION_API_KEY not configured');
    }

    // Fetch from Notion API
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sorts: [
          {
            property: 'Data',
            direction: 'descending'
          }
        ],
        page_size: 30
      })
    });

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error('Notion API error:', errorText);
      throw new Error(`Failed to fetch from Notion: ${notionResponse.status}`);
    }

    const notionData = await notionResponse.json();
    console.log(`Fetched ${notionData.results?.length || 0} records from Notion`);

    // Process and store metrics
    const metricsToStore = [];
    
    for (const page of notionData.results || []) {
      const properties = page.properties;
      
      // Extract data from Notion properties
      // Adjust property names based on your actual Notion database structure
      const date = properties.Data?.date?.start || new Date().toISOString().split('T')[0];
      const followers = properties.Seguidores?.number || 0;
      const posts = properties.Posts?.number || 0;
      const likes = properties.Curtidas?.number || 0;
      const comments = properties.Comentários?.number || 0;
      const engagement = properties['Taxa de Engajamento']?.number || 0;

      metricsToStore.push({
        client_id: clientId,
        platform: 'instagram',
        metric_date: date,
        subscribers: followers,
        total_posts: posts,
        likes: likes,
        comments: comments,
        engagement_rate: engagement,
        metadata: {
          source: 'notion',
          notion_page_id: page.id
        }
      });
    }

    // Store in database using upsert
    for (const metric of metricsToStore) {
      const { error: upsertError } = await supabase
        .from('platform_metrics')
        .upsert(metric, {
          onConflict: 'client_id,platform,metric_date'
        });

      if (upsertError) {
        console.error('Error upserting metric:', upsertError);
      }
    }

    console.log(`Successfully stored ${metricsToStore.length} Instagram metrics from Notion`);

    return new Response(
      JSON.stringify({
        success: true,
        metrics_count: metricsToStore.length,
        latest_metrics: metricsToStore[0]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-notion-metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
