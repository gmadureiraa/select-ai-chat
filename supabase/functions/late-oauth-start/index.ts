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

    // If no profile exists, get or create one
    if (!profileId) {
      // List existing profiles
      const profilesResponse = await fetch(`${LATE_API_BASE}/v1/profiles`, {
        headers: {
          "Authorization": `Bearer ${LATE_API_KEY}`,
        },
      });

      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        if (profilesData.profiles && profilesData.profiles.length > 0) {
          // Use the first profile
          profileId = profilesData.profiles[0]._id;
        } else {
          // Create a new profile
          const createProfileResponse = await fetch(`${LATE_API_BASE}/v1/profiles`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LATE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: `Client ${clientId}`,
            }),
          });

          if (createProfileResponse.ok) {
            const newProfile = await createProfileResponse.json();
            profileId = newProfile.profile._id;
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
        }
      } else {
        const errorText = await profilesResponse.text();
        console.error("Failed to list Late profiles:", errorText);
        return new Response(JSON.stringify({ 
          error: "Failed to access Late profiles",
          details: errorText 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store the profile ID for this client
      await supabase
        .from('client_social_credentials')
        .upsert({
          client_id: clientId,
          platform: 'late_profile',
          metadata: { late_profile_id: profileId },
          is_valid: true,
        }, {
          onConflict: 'client_id,platform',
        });
    }

    // Build callback URL
    const callbackUrl = `${supabaseUrl}/functions/v1/late-oauth-callback`;

    // Call Late API to start OAuth flow
    const connectUrl = new URL(`${LATE_API_BASE}/v1/connect/${platform}`);
    connectUrl.searchParams.set('profileId', profileId);
    connectUrl.searchParams.set('redirect_url', `${callbackUrl}?clientId=${clientId}&platform=${platform}`);

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
