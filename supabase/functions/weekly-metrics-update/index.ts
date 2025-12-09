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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[weekly-metrics-update] Starting weekly metrics update...');

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, tags, social_media');

    if (clientsError) {
      throw clientsError;
    }

    const results: { clientId: string; clientName: string; updated: string[]; skipped: string[] }[] = [];

    for (const client of clients || []) {
      const clientResult = {
        clientId: client.id,
        clientName: client.name,
        updated: [] as string[],
        skipped: [] as string[],
      };

      // Check archived channels
      const tags = client.tags as any || {};
      const archivedChannels = tags.archived_channels || [];
      const socialMedia = client.social_media as any || {};

      // Update YouTube if not archived and has channel configured
      if (!archivedChannels.includes('youtube')) {
        const channelId = socialMedia.youtube_channel_id;
        if (channelId) {
          try {
            // Call fetch-youtube-metrics
            const { error } = await supabase.functions.invoke('fetch-youtube-metrics', {
              body: { clientId: client.id, channelId }
            });
            if (!error) {
              clientResult.updated.push('youtube');
              console.log(`[weekly-metrics-update] Updated YouTube for ${client.name}`);
            } else {
              clientResult.skipped.push('youtube (error)');
            }
          } catch (e) {
            clientResult.skipped.push('youtube (error)');
          }
        } else {
          clientResult.skipped.push('youtube (not configured)');
        }
      } else {
        clientResult.skipped.push('youtube (archived)');
      }

      // Update Instagram if not archived
      if (!archivedChannels.includes('instagram')) {
        const instagramUrl = socialMedia.instagram;
        if (instagramUrl) {
          const username = instagramUrl.split('/').filter(Boolean).pop();
          if (username) {
            try {
              const { error } = await supabase.functions.invoke('fetch-instagram-metrics', {
                body: { clientId: client.id, username }
              });
              if (!error) {
                clientResult.updated.push('instagram');
                console.log(`[weekly-metrics-update] Updated Instagram for ${client.name}`);
              } else {
                clientResult.skipped.push('instagram (error)');
              }
            } catch (e) {
              clientResult.skipped.push('instagram (error)');
            }
          }
        } else {
          clientResult.skipped.push('instagram (not configured)');
        }
      } else {
        clientResult.skipped.push('instagram (archived)');
      }

      // Update Newsletter if not archived
      if (!archivedChannels.includes('newsletter')) {
        try {
          const { error } = await supabase.functions.invoke('fetch-beehiiv-metrics', {
            body: { clientId: client.id }
          });
          if (!error) {
            clientResult.updated.push('newsletter');
            console.log(`[weekly-metrics-update] Updated Newsletter for ${client.name}`);
          } else {
            clientResult.skipped.push('newsletter (error)');
          }
        } catch (e) {
          clientResult.skipped.push('newsletter (error or not configured)');
        }
      } else {
        clientResult.skipped.push('newsletter (archived)');
      }

      results.push(clientResult);
    }

    console.log('[weekly-metrics-update] Completed. Results:', JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      clientsProcessed: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[weekly-metrics-update] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});