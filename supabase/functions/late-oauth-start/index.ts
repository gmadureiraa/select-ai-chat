import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OAuthStartRequest {
  clientId: string;
  platform: 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube';
  redirectUri?: string;
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clientId, platform, redirectUri }: OAuthStartRequest = await req.json();

    if (!clientId || !platform) {
      return new Response(JSON.stringify({ error: "Missing clientId or platform" }), {
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

    // Get origin for callback URL
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://kai-kaleidos.lovable.app";
    let baseUrl = origin;
    try {
      const url = new URL(origin);
      baseUrl = url.origin;
    } catch {
      baseUrl = "https://kai-kaleidos.lovable.app";
    }

    // Create state with all necessary data
    const state = btoa(JSON.stringify({
      clientId,
      platform,
      userId: user.id,
      timestamp: Date.now(),
    }));

    const callbackUrl = `${supabaseUrl}/functions/v1/late-oauth-callback`;

    // Call Late API to start OAuth flow
    const lateResponse = await fetch("https://api.getlate.dev/v1/oauth/authorize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: platform,
        redirect_uri: callbackUrl,
        state: state,
      }),
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      console.error("Late API error:", lateResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: "Failed to start OAuth flow",
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lateData = await lateResponse.json();
    
    console.log("Late OAuth started:", { platform, clientId, authUrl: lateData.authorization_url });

    return new Response(JSON.stringify({
      authUrl: lateData.authorization_url,
      callbackUrl,
      state,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in late-oauth-start:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
