import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication for cron jobs
  // Supabase cron jobs may not send auth header, so we check multiple conditions
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  // Accept requests from:
  // 1. Supabase internal cron scheduler (x-supabase-eed-request header)
  // 2. Service role key authentication
  // 3. Supabase pg_cron (no auth but valid internal call)
  const isCronJob = req.headers.get('x-supabase-eed-request') === 'true' || 
                    req.headers.get('user-agent')?.includes('Supabase') ||
                    req.headers.get('x-supabase-cron') === 'true';
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isCronJob && !isServiceRole) {
    console.error('[process-scheduled-posts] Unauthorized access attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Service role required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log(`[process-scheduled-posts] Auth check passed: isCronJob=${isCronJob}, isServiceRole=${isServiceRole}`);

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    const now = new Date();
    // Add 2 minute margin to catch posts that are about to be due
    const marginTime = new Date(now.getTime() + 2 * 60 * 1000);
    
    console.log(`[process-scheduled-posts] Running at ${now.toISOString()}`);
    console.log(`[process-scheduled-posts] Looking for posts scheduled before ${marginTime.toISOString()}`);

    // First, process planning_items (new unified table)
    // Filter by next_retry_at for exponential backoff
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
      .lte('scheduled_at', marginTime.toISOString())
      .lt('retry_count', 3)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`)
      .order('scheduled_at', { ascending: true })
      .limit(25);

    if (planningError) {
      console.error("Error fetching planning items:", planningError);
      throw new Error(`Error fetching planning items: ${planningError.message}`);
    }

    // Also process legacy scheduled_posts table (with graceful fallback)
    // This table may not exist in all environments, so we wrap in try/catch
    let legacyPosts: unknown[] = [];
    try {
      const { data: legacyData, error: legacyError } = await supabaseClient
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_at', marginTime.toISOString())
        .lt('retry_count', 3)
        .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`)
        .order('scheduled_at', { ascending: true })
        .limit(25);

      if (legacyError) {
        // Log but don't fail - table may not exist or have different schema
        console.log("[process-scheduled-posts] Legacy table query failed (may not exist):", legacyError.message);
      } else {
        legacyPosts = legacyData || [];
      }
    } catch (legacyQueryError) {
      // Table may not exist - this is expected in newer environments
      console.log("[process-scheduled-posts] Legacy scheduled_posts table not available:", legacyQueryError);
    }

    const allItems = [
      ...(planningItems || []).map(item => ({ ...item, source: 'planning_items' })),
      ...legacyPosts.map((post: unknown) => ({ ...(post as Record<string, unknown>), source: 'scheduled_posts' })),
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

        // Use late-post for all supported platforms
        const supportedPlatforms = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads'];
        
        if (!supportedPlatforms.includes(item.platform)) {
          // Mark as manual publish required for unsupported platforms
          console.log(`Platform ${item.platform} requires manual publishing`);
          
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

        // Extract thread items from metadata if available
        const metadata = item.metadata as Record<string, unknown> | null;
        const threadTweets = metadata?.thread_tweets as Array<{ text: string; media_urls?: string[] }> | undefined;

        // Call late-post for all platforms
        const response = await fetch(`${supabaseUrl}/functions/v1/late-post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ 
            clientId: item.client_id,
            platform: item.platform,
            content: item.content || item.description || '',
            mediaUrls: item.media_urls || [],
            threadItems: threadTweets,
            planningItemId: item.id,
            publishNow: true,
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
          // Update with error and exponential backoff
          const newRetryCount = (item.retry_count || 0) + 1;
          const retryDelayMs = Math.pow(2, newRetryCount) * 60 * 1000; // 2min, 4min, 8min
          const nextRetryAt = new Date(Date.now() + retryDelayMs);
          
          // If max retries reached, mark as failed; otherwise keep scheduled for retry
          const newStatus = newRetryCount >= 3 ? 'failed' : 'scheduled';
          
          await supabaseClient
            .from(tableName)
            .update({
              status: newStatus,
              error_message: result.error || 'Erro desconhecido',
              retry_count: newRetryCount,
              next_retry_at: newRetryCount < 3 ? nextRetryAt.toISOString() : null,
            })
            .eq('id', item.id);

          // Create notification for failure (with owner fallback)
          if (item.workspace_id && newStatus === 'failed') {
            // Determine recipient: created_by > assigned_to > workspace owner
            let notifyUserId = item.created_by || item.assigned_to;
            
            if (!notifyUserId) {
              const { data: workspace } = await supabaseClient
                .from('workspaces')
                .select('owner_id')
                .eq('id', item.workspace_id)
                .single();
              notifyUserId = workspace?.owner_id;
            }
            
            if (notifyUserId) {
              await supabaseClient
                .from('notifications')
                .insert({
                  workspace_id: item.workspace_id,
                  user_id: notifyUserId,
                  type: 'publish_failed',
                  title: `Falha ao publicar "${(item.title || 'Post').substring(0, 30)}..."`,
                  message: result.error || 'Erro desconhecido após 3 tentativas',
                  metadata: {
                    planning_item_id: item.id,
                    platform: item.platform,
                    client_id: item.client_id,
                    retry_count: newRetryCount,
                  },
                });
              console.log(`🔔 Notification created for failed post ${item.id}`);
            }
          }

          console.log(`❌ Post ${item.id} ${newStatus === 'failed' ? 'failed permanently' : 'will retry at ' + nextRetryAt.toISOString()}: ${result.error}`);
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
        
        const newRetryCount = (item.retry_count || 0) + 1;
        const retryDelayMs = Math.pow(2, newRetryCount) * 60 * 1000;
        const nextRetryAt = new Date(Date.now() + retryDelayMs);
        const newStatus = newRetryCount >= 3 ? 'failed' : 'scheduled';
        
        await supabaseClient
          .from(tableName)
          .update({
            status: newStatus,
            error_message: message,
            retry_count: newRetryCount,
            next_retry_at: newRetryCount < 3 ? nextRetryAt.toISOString() : null,
          })
          .eq('id', item.id);
        
        // Create notification for permanent failure (with owner fallback)
        if (item.workspace_id && newStatus === 'failed') {
          let notifyUserId = item.created_by || item.assigned_to;
          
          if (!notifyUserId) {
            const { data: workspace } = await supabaseClient
              .from('workspaces')
              .select('owner_id')
              .eq('id', item.workspace_id)
              .single();
            notifyUserId = workspace?.owner_id;
          }
          
          if (notifyUserId) {
            await supabaseClient
              .from('notifications')
              .insert({
                workspace_id: item.workspace_id,
                user_id: notifyUserId,
                type: 'publish_failed',
                title: `Falha ao publicar "${(item.title || 'Post').substring(0, 30)}..."`,
                message: message,
                metadata: {
                  planning_item_id: item.id,
                  platform: item.platform,
                  client_id: item.client_id,
                },
              });
          }
        }

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
