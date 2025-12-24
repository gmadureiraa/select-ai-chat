import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    console.log("Processing scheduled posts...");

    // Get all posts that should be published now
    const now = new Date().toISOString();
    const { data: posts, error: postsError } = await supabaseClient
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .lt('retry_count', 3) // Don't retry more than 3 times
      .order('scheduled_at', { ascending: true })
      .limit(10); // Process max 10 at a time

    if (postsError) {
      throw new Error(`Error fetching posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      console.log("No posts to process");
      return new Response(JSON.stringify({ 
        processed: 0, 
        message: "No posts to process" 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${posts.length} posts to process`);

    const results: { postId: string; platform: string; success: boolean; error?: string }[] = [];

    for (const post of posts) {
      try {
        let functionName: string;
        
        if (post.platform === 'twitter') {
          functionName = 'twitter-post';
        } else if (post.platform === 'linkedin') {
          functionName = 'linkedin-post';
        } else {
          console.log(`Unknown platform: ${post.platform}`);
          await supabaseClient
            .from('scheduled_posts')
            .update({
              status: 'failed',
              error_message: `Plataforma não suportada: ${post.platform}`,
            })
            .eq('id', post.id);
          
          results.push({
            postId: post.id,
            platform: post.platform,
            success: false,
            error: `Unknown platform: ${post.platform}`,
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
          body: JSON.stringify({ scheduledPostId: post.id }),
        });

        const result = await response.json();

        results.push({
          postId: post.id,
          platform: post.platform,
          success: result.success,
          error: result.error,
        });

        console.log(`Post ${post.id} (${post.platform}): ${result.success ? 'success' : 'failed'}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`Error processing post ${post.id}:`, error);
        
        await supabaseClient
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error_message: message,
            retry_count: (post.retry_count || 0) + 1,
          })
          .eq('id', post.id);

        results.push({
          postId: post.id,
          platform: post.platform,
          success: false,
          error: message,
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
