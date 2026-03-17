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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, batchSize = 3 } = await req.json();

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get posts that need full sync (no images stored OR no content_synced_at)
    const { data: posts, error: queryError } = await adminClient
      .from('instagram_posts')
      .select('id, images, caption, post_type, permalink')
      .eq('client_id', clientId)
      .or('content_synced_at.is.null')
      .not('permalink', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(batchSize);

    if (queryError) throw new Error(queryError.message);

    if (!posts || posts.length === 0) {
      const { count: remaining } = await adminClient
        .from('instagram_posts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .is('content_synced_at', null);

      return new Response(JSON.stringify({ 
        message: 'No posts to sync', processed: 0, remaining: remaining || 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Count remaining
    const { count: totalRemaining } = await adminClient
      .from('instagram_posts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .is('content_synced_at', null);

    console.log(`[batch-sync] Processing ${posts.length} posts, ~${totalRemaining} remaining`);

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const post of posts) {
      try {
        if (!post.permalink) {
          results.push({ id: post.id, success: false, error: 'No permalink' });
          continue;
        }

        const isVideo = post.post_type === 'reel' || post.post_type === 'video' || 
                        post.permalink.includes('/reel/');

        // Step 1: Extract images from Instagram via Apify
        console.log(`[batch-sync] ${post.id}: Extracting from ${post.permalink}`);
        
        const extractResponse = await fetch(
          `${supabaseUrl}/functions/v1/extract-instagram`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: post.permalink,
              clientId,
              uploadToStorage: true,
            }),
          }
        );

        if (!extractResponse.ok) {
          const errText = await extractResponse.text();
          console.warn(`[batch-sync] ${post.id}: Extract failed: ${errText}`);
          results.push({ id: post.id, success: false, error: `Extract: ${extractResponse.status}` });
          continue;
        }

        const extractData = await extractResponse.json();
        const imageUrls = extractData?.images || [];
        const uploadedPaths: string[] = extractData?.uploadedPaths || [];
        const extractedCaption = extractData?.caption || post.caption;

        console.log(`[batch-sync] ${post.id}: Got ${imageUrls.length} images, ${uploadedPaths.length} uploaded`);

        // Step 2: Build thumbnail URL
        let thumbnailUrl: string | null = null;
        if (uploadedPaths.length > 0) {
          thumbnailUrl = `${supabaseUrl}/storage/v1/object/public/client-files/${uploadedPaths[0]}`;
        }

        // Step 3: Transcribe content
        let fullContent = "";
        let videoTranscript: string | null = null;

        if (isVideo) {
          // For videos: try to transcribe audio
          if (imageUrls.length > 0) {
            try {
              const transcribeResponse = await fetch(
                `${supabaseUrl}/functions/v1/transcribe-media`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    url: imageUrls[0],
                    fileName: `reels-${post.id}.mp4`,
                  }),
                }
              );

              if (transcribeResponse.ok) {
                const data = await transcribeResponse.json();
                if (data?.text) videoTranscript = data.text;
              }
            } catch (e) {
              console.warn(`[batch-sync] ${post.id}: Video transcription failed`, e);
            }
          }

          const parts: string[] = [];
          if (extractedCaption) parts.push(`## Legenda\n\n${extractedCaption}`);
          if (videoTranscript) parts.push(`## Roteiro/Transcrição do Vídeo\n\n${videoTranscript}`);
          fullContent = parts.join("\n\n---\n\n");

        } else {
          // For images/carousels: OCR transcription
          const transcriptions: string[] = [];
          
          for (let i = 0; i < imageUrls.length; i++) {
            try {
              const transcribeResponse = await fetch(
                `${supabaseUrl}/functions/v1/transcribe-images`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    imageUrls: [imageUrls[i]],
                    startIndex: i,
                    userId: 'batch-sync',
                    clientId,
                  }),
                }
              );

              if (transcribeResponse.ok) {
                const data = await transcribeResponse.json();
                if (data?.transcription) transcriptions.push(data.transcription);
              }
            } catch (e) {
              console.warn(`[batch-sync] ${post.id}: Image ${i} transcription failed`, e);
            }
          }

          const parts: string[] = [];
          if (extractedCaption) parts.push(extractedCaption);
          if (transcriptions.length > 0) {
            parts.push("---\n\n## Transcrição das Imagens\n\n" + transcriptions.join('\n\n---\n\n'));
          }
          fullContent = parts.join("\n\n");
        }

        // Step 4: Update the post
        const updateData: Record<string, unknown> = {
          full_content: fullContent || extractedCaption || '[Sem conteúdo]',
          images: uploadedPaths,
          thumbnail_url: thumbnailUrl,
          content_synced_at: new Date().toISOString(),
        };

        if (isVideo) {
          updateData.video_transcript = videoTranscript;
        }

        const { error: updateError } = await adminClient
          .from('instagram_posts')
          .update(updateData)
          .eq('id', post.id);

        if (updateError) {
          results.push({ id: post.id, success: false, error: updateError.message });
        } else {
          results.push({ id: post.id, success: true });
          console.log(`[batch-sync] ${post.id}: ✅ synced (${uploadedPaths.length} images, thumb: ${!!thumbnailUrl})`);
        }

      } catch (postError) {
        console.error(`[batch-sync] ${post.id}: Error:`, postError);
        results.push({ 
          id: post.id, success: false, 
          error: postError instanceof Error ? postError.message : 'Unknown' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[batch-sync] Done: ${successCount}/${posts.length} successful`);

    return new Response(JSON.stringify({
      processed: posts.length,
      successful: successCount,
      failed: posts.length - successCount,
      remaining: (totalRemaining || 0) - posts.length,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[batch-sync] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
