import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LATE_API_BASE = "https://getlate.dev/api";

interface PostRequest {
  clientId: string;
  platform: 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'threads';
  content: string;
  mediaUrls?: string[];
  planningItemId?: string;
  scheduledFor?: string; // ISO date string for scheduling
  publishNow?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // For auth verification use anon key
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { clientId, platform, content, mediaUrls, planningItemId, scheduledFor, publishNow = true }: PostRequest = await req.json();

    if (!clientId || !platform || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");
    if (!LATE_API_KEY) {
      return new Response(JSON.stringify({ error: "LATE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credentials from database
    const { data: credentials, error: credError } = await supabase
      .from("client_social_credentials")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .single();

    if (credError || !credentials) {
      console.error("No credentials found:", { clientId, platform, credError });
      return new Response(JSON.stringify({ 
        error: `Credenciais do ${platform} não encontradas para este cliente. Conecte a conta primeiro.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!credentials.is_valid) {
      console.error("Invalid credentials:", { clientId, platform, validationError: credentials.validation_error });
      return new Response(JSON.stringify({ 
        error: `Credenciais do ${platform} estão inválidas. Reconecte a conta.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Late account ID from metadata
    const metadata = credentials.metadata as Record<string, unknown> | null;
    const lateAccountId = metadata?.late_account_id || credentials.account_id;

    console.log("Credentials found:", { 
      clientId, 
      platform, 
      accountId: credentials.account_id,
      lateAccountId,
      accountName: credentials.account_name,
      metadata: credentials.metadata
    });

    if (!lateAccountId) {
      console.error("No Late account ID found:", { clientId, platform, metadata });
      return new Response(JSON.stringify({ 
        error: "Conta não está corretamente conectada via Late API. Reconecte a conta." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare post payload for Late API according to OpenAPI spec
    const postPayload: Record<string, unknown> = {
      content: content,
      platforms: [
        {
          platform: platform,
          accountId: lateAccountId,
        }
      ],
      publishNow: publishNow,
    };

    // Add scheduled time if provided
    if (scheduledFor && !publishNow) {
      postPayload.scheduledFor = scheduledFor;
      postPayload.publishNow = false;
    }

    // Add media if provided
    if (mediaUrls && mediaUrls.length > 0) {
      postPayload.mediaItems = mediaUrls.map(url => ({
        type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
        url: url,
      }));
    }

    console.log("Late API post payload:", JSON.stringify(postPayload, null, 2));

    // Post via Late API
    const postResponse = await fetch(`${LATE_API_BASE}/v1/posts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error("Late API post error:", { 
        status: postResponse.status, 
        errorText,
        clientId,
        platform,
        lateAccountId 
      });
      
      // Update planning item if applicable
      if (planningItemId) {
        await supabase
          .from("planning_items")
          .update({
            status: "failed",
            error_message: `Erro Late API (${postResponse.status}): ${errorText}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", planningItemId);
      }

      // Parse error for better user message
      let userMessage = "Falha ao publicar conteúdo";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          userMessage = errorJson.message;
        } else if (errorJson.error) {
          userMessage = errorJson.error;
        }
      } catch {
        // Keep default message if not JSON
      }

      return new Response(JSON.stringify({ 
        error: userMessage,
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postData = await postResponse.json();
    console.log("Post successful:", postData);

    // Extract published URL from response
    const publishedUrl = postData.post?.platforms?.[0]?.platformPostUrl || 
                        postData.post?.platforms?.[0]?.publishedUrl ||
                        null;

    // Determine new status based on whether post was scheduled or published
    const newStatus = publishNow ? "published" : "scheduled";

    // Update planning item status if applicable
    if (planningItemId) {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        error_message: null,
        updated_at: new Date().toISOString(),
        external_post_id: postData.post?._id,
      };

      if (publishNow) {
        updateData.published_at = new Date().toISOString();
      }

      if (scheduledFor) {
        updateData.scheduled_at = scheduledFor;
      }

      await supabase
        .from("planning_items")
        .update(updateData)
        .eq("id", planningItemId);

      // Also save to client content library if published
      if (publishNow) {
        const contentTypeMap: Record<string, string> = {
          twitter: 'tweet',
          linkedin: 'linkedin_post',
          instagram: 'instagram_post',
          facebook: 'facebook_post',
          tiktok: 'tiktok_video',
          youtube: 'youtube_video',
          threads: 'threads_post',
        };

        await supabase
          .from("client_content_library")
          .insert({
            client_id: clientId,
            title: content.substring(0, 100),
            content: content,
            content_type: contentTypeMap[platform] || 'post',
            content_url: publishedUrl,
            metadata: {
              platform,
              posted_at: new Date().toISOString(),
              late_post_id: postData.post?._id,
            },
          });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      postId: postData.post?._id,
      status: newStatus,
      url: publishedUrl,
      platform,
      message: postData.message,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in late-post:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
