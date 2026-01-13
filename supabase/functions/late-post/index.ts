import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PostRequest {
  clientId: string;
  platform: 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube';
  content: string;
  mediaUrls?: string[];
  planningItemId?: string;
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

    const { clientId, platform, content, mediaUrls, planningItemId }: PostRequest = await req.json();

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
      return new Response(JSON.stringify({ 
        error: `No ${platform} credentials found for this client` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!credentials.is_valid) {
      return new Response(JSON.stringify({ 
        error: `${platform} credentials are invalid. Please reconnect.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Late account ID from metadata
    const metadata = credentials.metadata as Record<string, unknown> | null;
    const lateAccountId = metadata?.late_account_id || credentials.account_id;

    if (!lateAccountId) {
      return new Response(JSON.stringify({ 
        error: "Account not properly connected via Late API" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare post payload for Late API
    const postPayload: Record<string, unknown> = {
      account_id: lateAccountId,
      text: content,
    };

    // Add media if provided
    if (mediaUrls && mediaUrls.length > 0) {
      postPayload.media = mediaUrls.map(url => ({ url }));
    }

    console.log("Posting via Late API:", { platform, accountId: lateAccountId, contentLength: content.length });

    // Post via Late API
    const postResponse = await fetch("https://api.getlate.dev/v1/posts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error("Late API post error:", postResponse.status, errorText);
      
      // Update planning item if applicable
      if (planningItemId) {
        await supabase
          .from("planning_items")
          .update({
            status: "failed",
            error_message: `Late API error: ${errorText}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", planningItemId);
      }

      return new Response(JSON.stringify({ 
        error: "Failed to post content",
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postData = await postResponse.json();
    console.log("Post successful:", postData);

    // Update planning item status if applicable
    if (planningItemId) {
      await supabase
        .from("planning_items")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_url: postData.url || postData.permalink,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planningItemId);

      // Also save to client content library
      await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          title: content.substring(0, 100),
          content: content,
          content_type: platform === 'twitter' ? 'tweet' : 'linkedin_post',
          content_url: postData.url || postData.permalink,
          metadata: {
            platform,
            posted_at: new Date().toISOString(),
            late_post_id: postData.id,
          },
        });
    }

    return new Response(JSON.stringify({
      success: true,
      postId: postData.id,
      url: postData.url || postData.permalink,
      platform,
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
