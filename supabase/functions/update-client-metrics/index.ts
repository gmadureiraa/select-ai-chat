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

    console.log('Updating metrics for client:', clientId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, fetch the latest metrics from Beehiiv
    const beehiivApiKey = Deno.env.get('BEEHIIV_API_KEY');
    if (!beehiivApiKey) {
      throw new Error('Beehiiv API key not configured');
    }

    // Fetch publication data with expanded stats
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
      throw new Error(`Beehiiv API error: ${publicationResponse.status}`);
    }

    const publications = await publicationResponse.json();
    const publication = publications.data?.[0];
    
    if (!publication) {
      throw new Error('No publication found');
    }

    // Extract metrics
    const stats = publication.stats || {};
    const subscribers = stats.active_subscriptions || stats.stat_active_subscriptions || 0;
    const openRate = stats.average_open_rate || stats.stat_average_open_rate || 0;
    const clickRate = stats.average_click_rate || stats.stat_average_click_rate || 0;

    console.log('Extracted metrics:', { subscribers, openRate, clickRate });

    // Store metrics in database
    const metricDate = new Date().toISOString().split('T')[0];
    await supabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'newsletter',
        metric_date: metricDate,
        subscribers: subscribers,
        open_rate: parseFloat(openRate),
        click_rate: parseFloat(clickRate),
        total_posts: 0,
        metadata: {
          publication_name: publication.name,
          publication_id: publication.id,
          raw_stats: stats,
        },
      }, {
        onConflict: 'client_id,platform,metric_date',
      });

    // Get client data to update context
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('context_notes')
      .eq('id', clientId)
      .single();

    if (clientError) throw clientError;

    // Format metrics section
    const metricsSection = `\n\n## 📊 Métricas da Newsletter (Atualizado: ${new Date().toLocaleDateString('pt-BR')})\n\n` +
      `- **Assinantes**: ${subscribers.toLocaleString('pt-BR')}\n` +
      `- **Taxa de Abertura**: ${(parseFloat(openRate) * 100).toFixed(1)}%\n` +
      `- **Taxa de Clique**: ${(parseFloat(clickRate) * 100).toFixed(1)}%\n` +
      `- **Publicação**: ${publication.name}\n`;

    // Update client context - remove old metrics section if exists and add new one
    let updatedContext = client.context_notes || '';
    
    // Remove previous metrics section if exists
    const metricsRegex = /\n\n## 📊 Métricas da Newsletter.*?(?=\n\n##|\n\n$|$)/s;
    updatedContext = updatedContext.replace(metricsRegex, '');
    
    // Add new metrics section at the end
    updatedContext = updatedContext.trim() + metricsSection;

    // Update client
    const { error: updateError } = await supabase
      .from('clients')
      .update({ context_notes: updatedContext })
      .eq('id', clientId);

    if (updateError) throw updateError;

    console.log('Client context updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscribers,
          openRate: parseFloat(openRate),
          clickRate: parseFloat(clickRate),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in update-client-metrics:', error);
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