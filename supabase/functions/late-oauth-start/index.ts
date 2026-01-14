import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OAuthStartRequest {
  clientId: string;
  platform: 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'threads';
}

const LATE_API_BASE = "https://getlate.dev/api";

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

    const { clientId, platform }: OAuthStartRequest = await req.json();

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

    // Get or create Late profile for this client
    // First, check if we have a stored profile ID
    const { data: credentials } = await supabase
      .from('client_social_credentials')
      .select('metadata')
      .eq('client_id', clientId)
      .eq('platform', 'late_profile')
      .single();

    let profileId = credentials?.metadata?.late_profile_id;

    // If no profile exists for this client, always create a new unique one
    if (!profileId) {
      // Create a new unique profile for each client using timestamp for uniqueness
      const uniqueName = `kai-client-${clientId.substring(0, 8)}-${Date.now()}`;
      console.log("Creating new Late profile with name:", uniqueName);
      
      const createProfileResponse = await fetch(`${LATE_API_BASE}/v1/profiles`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: uniqueName,
        }),
      });

      if (createProfileResponse.ok) {
        const newProfile = await createProfileResponse.json();
        profileId = newProfile.profile._id;
        console.log("Created new Late profile:", { profileId, name: uniqueName });
      } else {
        const errorText = await createProfileResponse.text();
        console.error("Failed to create Late profile:", errorText);
        return new Response(JSON.stringify({ 
          error: "Failed to create Late profile",
          details: errorText 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store the profile ID for this client (using service role to bypass RLS)
      const supabaseServiceRole = createClient(
        supabaseUrl, 
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      const { data: savedProfile, error: saveError } = await supabaseServiceRole
        .from('client_social_credentials')
        .upsert({
          client_id: clientId,
          platform: 'late_profile',
          account_id: profileId, // Also save as account_id for easier lookup
          account_name: uniqueName,
          metadata: { late_profile_id: profileId, client_id: clientId },
          is_valid: true,
        }, {
          onConflict: 'client_id,platform',
        })
        .select();

      console.log("Saved late_profile:", { savedProfile, saveError });
      
      if (saveError) {
        console.error("Error saving late_profile:", saveError);
      }
    }

    // Build callback URL - DO NOT add query params here, Late API will append its own
    // We'll store the mapping client_id -> profile_id so the callback can look it up
    const callbackUrl = `${supabaseUrl}/functions/v1/late-oauth-callback`;

    // Call Late API to start OAuth flow
    const connectUrl = new URL(`${LATE_API_BASE}/v1/connect/${platform}`);
    connectUrl.searchParams.set('profileId', profileId);
    // Use clean redirect_url without extra query params
    connectUrl.searchParams.set('redirect_url', callbackUrl);

    console.log("Starting OAuth with URL:", connectUrl.toString());

    const lateResponse = await fetch(connectUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
      },
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
    
    console.log("Late OAuth started:", { platform, clientId, profileId, authUrl: lateData.authUrl });

    return new Response(JSON.stringify({
      authUrl: lateData.authUrl,
      profileId,
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
