import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify service role authentication for cron jobs
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    console.error('[process-scheduled-posts] Unauthorized access attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Service role required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    console.log("Processing scheduled posts from planning_items...");

    const now = new Date().toISOString();
    
    // First, process planning_items (new unified table)
    const { data: planningItems, error: planningError } = await supabaseClient
      .from('planning_items')
      .select(`
        *,
        clients:client_id (
          id,
          name
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .lt('retry_count', 3)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (planningError) {
      console.error("Error fetching planning items:", planningError);
      throw new Error(`Error fetching planning items: ${planningError.message}`);
    }

    // Also process legacy scheduled_posts table
    const { data: legacyPosts, error: legacyError } = await supabaseClient
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .lt('retry_count', 3)
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (legacyError) {
      console.error("Error fetching legacy posts:", legacyError);
    }

    const allItems = [
      ...(planningItems || []).map(item => ({ ...item, source: 'planning_items' })),
      ...(legacyPosts || []).map(post => ({ ...post, source: 'scheduled_posts' })),
    ];

    if (allItems.length === 0) {
      console.log("No posts to process");
      return new Response(JSON.stringify({ 
        processed: 0, 
        message: "No posts to process" 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${allItems.length} posts to process (${planningItems?.length || 0} planning, ${legacyPosts?.length || 0} legacy)`);

    const results: { 
      postId: string; 
      platform: string; 
      success: boolean; 
      error?: string;
      source: string;
    }[] = [];

    for (const item of allItems) {
      const tableName = item.source;
      
      try {
        // Update status to publishing
        await supabaseClient
          .from(tableName)
          .update({ status: 'publishing' })
          .eq('id', item.id);

        let functionName: string | null = null;
        
        if (item.platform === 'twitter') {
          functionName = 'twitter-post';
        } else if (item.platform === 'linkedin') {
          functionName = 'linkedin-post';
        } else {
          // Mark as manual publish required for unsupported platforms
          console.log(`Platform ${item.platform} requires manual publishing`);
          
          // Move back to scheduled but don't fail
          await supabaseClient
            .from(tableName)
            .update({
              status: 'scheduled',
              error_message: `Plataforma ${item.platform} requer publicação manual`,
            })
            .eq('id', item.id);
          
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: `Manual publish required for ${item.platform}`,
            source: tableName,
          });
          continue;
        }

        // Check if client has valid credentials
        const { data: credentials } = await supabaseClient
          .from('client_social_credentials')
          .select('is_valid')
          .eq('client_id', item.client_id)
          .eq('platform', item.platform)
          .single();

        if (!credentials?.is_valid) {
          console.log(`No valid credentials for ${item.platform} on client ${item.client_id}`);
          
          await supabaseClient
            .from(tableName)
            .update({
              status: 'scheduled',
              error_message: `Credenciais inválidas ou não configuradas para ${item.platform}`,
            })
            .eq('id', item.id);
          
          results.push({
            postId: item.id,
            platform: item.platform,
            success: false,
            error: 'No valid credentials',
            source: tableName,
          });
          continue;
        }

        // Call the appropriate posting function
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ 
            scheduledPostId: item.id,
            source: tableName,
          }),
        });

        const result = await response.json();

        if (result.success) {
          // Get the published column for moving the card
          const { data: publishedColumn } = await supabaseClient
            .from('kanban_columns')
            .select('id')
            .eq('workspace_id', item.workspace_id)
            .eq('column_type', 'published')
            .single();

          // Update to published status
          await supabaseClient
            .from(tableName)
            .update({
              status: 'published',
              published_at: new Date().toISOString(),
              external_post_id: result.externalId || null,
              error_message: null,
              ...(publishedColumn && tableName === 'planning_items' ? { column_id: publishedColumn.id } : {}),
            })
            .eq('id', item.id);

          // ===== AUTO-SAVE TO CONTENT LIBRARY ON PUBLISH =====
          // Only save to content library when item is published successfully
          if (tableName === 'planning_items' && item.client_id && !item.added_to_library) {
            try {
              // Map platform to content type
              const contentTypeMap: Record<string, string> = {
                'twitter': 'tweet',
                'instagram': 'post',
                'linkedin': 'linkedin_post',
                'facebook': 'social_post',
                'tiktok': 'script',
                'youtube': 'script',
                'newsletter': 'newsletter',
                'blog': 'article',
              };
              const mappedType = contentTypeMap[item.platform?.toLowerCase() || ''] || 'post';
              
              const { data: savedContent, error: saveError } = await supabaseClient
                .from('client_content_library')
                .insert({
                  client_id: item.client_id,
                  title: item.title,
                  content: item.content || item.description || '',
                  content_type: mappedType,
                  metadata: {
                    auto_saved_on_publish: true,
                    from_planning: true,
                    original_item_id: item.id,
                    platform: item.platform,
                    published_at: new Date().toISOString(),
                    external_post_id: result.externalId || null,
                  }
                })
                .select('id')
                .single();
              
              if (saveError) {
                console.error(`[process-scheduled-posts] Error saving to content library:`, saveError);
              } else {
                // Update planning item with content library reference
                await supabaseClient
                  .from('planning_items')
                  .update({ 
                    added_to_library: true,
                    content_library_id: savedContent.id 
                  })
                  .eq('id', item.id);
                
                console.log(`📚 Content auto-saved to library: ${savedContent.id}`);
              }
            } catch (saveErr) {
              console.error(`[process-scheduled-posts] Exception saving content:`, saveErr);
            }
          }

          console.log(`✅ Post ${item.id} published successfully`);
        } else {
          // Update with error
          await supabaseClient
            .from(tableName)
            .update({
              status: 'failed',
              error_message: result.error || 'Erro desconhecido',
              retry_count: (item.retry_count || 0) + 1,
            })
            .eq('id', item.id);

          console.log(`❌ Post ${item.id} failed: ${result.error}`);
        }

        results.push({
          postId: item.id,
          platform: item.platform,
          success: result.success,
          error: result.error,
          source: tableName,
        });

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`Error processing post ${item.id}:`, error);
        
        await supabaseClient
          .from(tableName)
          .update({
            status: 'failed',
            error_message: message,
            retry_count: (item.retry_count || 0) + 1,
          })
          .eq('id', item.id);

        results.push({
          postId: item.id,
          platform: item.platform,
          success: false,
          error: message,
          source: tableName,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`Processed ${results.length} posts: ${successCount} success, ${failedCount} failed`);

    return new Response(JSON.stringify({
      processed: results.length,
      success: successCount,
      failed: failedCount,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("Process scheduled posts error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
