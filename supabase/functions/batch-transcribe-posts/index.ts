import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Auth required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, batchSize = 5, postTypes } = await req.json();

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get posts that need transcription (have images but no full_content)
    let query = adminClient
      .from('instagram_posts')
      .select('id, images, caption, post_type, permalink')
      .eq('client_id', clientId)
      .or('full_content.is.null,full_content.eq.')
      .order('posted_at', { ascending: false })
      .limit(batchSize);

    if (postTypes && postTypes.length > 0) {
      query = query.in('post_type', postTypes);
    }

    const { data: posts, error: queryError } = await query;

    if (queryError) {
      console.error('[batch-transcribe] Query error:', queryError);
      throw new Error(queryError.message);
    }

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No posts to transcribe', 
        processed: 0, 
        remaining: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Count remaining
    const { count: remaining } = await adminClient
      .from('instagram_posts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .or('full_content.is.null,full_content.eq.');

    console.log(`[batch-transcribe] Processing ${posts.length} posts, ~${remaining} remaining`);

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const post of posts) {
      try {
        const images = post.images as string[] | null;
        
        if (!images || images.length === 0) {
          // No images to transcribe, set caption as content
          await adminClient
            .from('instagram_posts')
            .update({ full_content: post.caption || '[Sem conteúdo visual]' })
            .eq('id', post.id);
          
          results.push({ id: post.id, success: true });
          console.log(`[batch-transcribe] Post ${post.id} (${post.post_type}): no images, used caption`);
          continue;
        }

        // Call transcribe-images function
        const transcribeResponse = await fetch(
          `${supabaseUrl}/functions/v1/transcribe-images`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageUrls: images,
              startIndex: 0,
              userId: user.id,
              clientId,
            }),
          }
        );

        if (!transcribeResponse.ok) {
          const errText = await transcribeResponse.text();
          console.error(`[batch-transcribe] Transcription failed for ${post.id}:`, errText);
          results.push({ id: post.id, success: false, error: errText });
          continue;
        }

        const transcribeData = await transcribeResponse.json();
        
        if (transcribeData.error) {
          results.push({ id: post.id, success: false, error: transcribeData.error });
          continue;
        }

        const transcription = transcribeData.transcription || '';

        // Update the post with transcription
        const { error: updateError } = await adminClient
          .from('instagram_posts')
          .update({ full_content: transcription })
          .eq('id', post.id);

        if (updateError) {
          results.push({ id: post.id, success: false, error: updateError.message });
        } else {
          results.push({ id: post.id, success: true });
          console.log(`[batch-transcribe] Post ${post.id}: transcribed ${images.length} images`);
        }
      } catch (postError) {
        console.error(`[batch-transcribe] Error processing ${post.id}:`, postError);
        results.push({ 
          id: post.id, 
          success: false, 
          error: postError instanceof Error ? postError.message : 'Unknown' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[batch-transcribe] Done: ${successCount}/${posts.length} successful`);

    return new Response(JSON.stringify({
      processed: posts.length,
      successful: successCount,
      failed: posts.length - successCount,
      remaining: (remaining || 0) - posts.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[batch-transcribe] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
