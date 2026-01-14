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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
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

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Strategy: Use a shared workspace profile to avoid "Profile limit reached" errors
    // Each client will have their own connected accounts within this shared profile
    
    // Check if we have a shared workspace profile
    const { data: workspaceProfile } = await supabaseAdmin
      .from('client_social_credentials')
      .select('metadata')
      .eq('platform', 'late_workspace_profile')
      .single();

    let profileId = (workspaceProfile?.metadata as Record<string, unknown>)?.late_profile_id as string;

    // If no workspace profile exists, create one
    if (!profileId) {
      const uniqueName = `kai-workspace-${Date.now()}`;
      console.log("Creating new Late workspace profile:", uniqueName);
      
      const createProfileResponse = await fetch(`${LATE_API_BASE}/v1/profiles`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: uniqueName }),
      });

      if (createProfileResponse.ok) {
        const newProfile = await createProfileResponse.json();
        profileId = newProfile.profile._id;
        console.log("Created workspace profile:", { profileId, name: uniqueName });

        // Save as workspace-level profile (using a special client_id placeholder)
        await supabaseAdmin
          .from('client_social_credentials')
          .upsert({
            client_id: clientId, // Use requesting client, but mark as workspace profile
            platform: 'late_workspace_profile',
            account_id: profileId,
            account_name: uniqueName,
            metadata: { late_profile_id: profileId, is_workspace_profile: true },
            is_valid: true,
          }, {
            onConflict: 'client_id,platform',
          });
      } else {
        const errorText = await createProfileResponse.text();
        console.error("Failed to create Late profile:", errorText);
        
        // Check if it's a profile limit error - try to find existing profile
        if (errorText.includes("Profile limit")) {
          // Try to get any existing profile from Late API
          const listProfilesResponse = await fetch(`${LATE_API_BASE}/v1/profiles`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${LATE_API_KEY}`,
            },
          });
          
          if (listProfilesResponse.ok) {
            const profilesData = await listProfilesResponse.json();
            if (profilesData.profiles && profilesData.profiles.length > 0) {
              profileId = profilesData.profiles[0]._id;
              console.log("Using existing profile due to limit:", profileId);
              
              // Save this as workspace profile
              await supabaseAdmin
                .from('client_social_credentials')
                .upsert({
                  client_id: clientId,
                  platform: 'late_workspace_profile',
                  account_id: profileId,
                  account_name: profilesData.profiles[0].name || 'shared',
                  metadata: { late_profile_id: profileId, is_workspace_profile: true },
                  is_valid: true,
                }, {
                  onConflict: 'client_id,platform',
                });
            }
          }
        }
        
        if (!profileId) {
          return new Response(JSON.stringify({ 
            error: "Limite de perfis do Late atingido. Entre em contato com o suporte.",
            details: errorText 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Create an OAuth connection attempt record
    // This allows the callback to know exactly which client/platform to save credentials for
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('oauth_connection_attempts')
      .insert({
        client_id: clientId,
        platform: platform,
        profile_id: profileId,
        created_by: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      })
      .select()
      .single();

    if (attemptError) {
      console.error("Failed to create connection attempt:", attemptError);
      return new Response(JSON.stringify({ 
        error: "Falha ao iniciar conexão. Tente novamente." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build callback URL with attemptId for correlation
    const callbackUrl = `${supabaseUrl}/functions/v1/late-oauth-callback?attemptId=${attempt.id}`;

    // Call Late API to start OAuth flow
    const connectUrl = new URL(`${LATE_API_BASE}/v1/connect/${platform}`);
    connectUrl.searchParams.set('profileId', profileId);
    connectUrl.searchParams.set('redirect_url', callbackUrl);

    console.log("Starting OAuth:", { 
      platform, 
      clientId, 
      profileId, 
      attemptId: attempt.id,
      connectUrl: connectUrl.toString() 
    });

    const lateResponse = await fetch(connectUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
      },
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      console.error("Late API error:", lateResponse.status, errorText);
      
      // Mark attempt as failed
      await supabaseAdmin
        .from('oauth_connection_attempts')
        .update({ error_message: errorText })
        .eq('id', attempt.id);
      
      return new Response(JSON.stringify({ 
        error: "Falha ao iniciar conexão OAuth",
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lateData = await lateResponse.json();
    
    console.log("Late OAuth started successfully:", { 
      platform, 
      clientId, 
      profileId, 
      attemptId: attempt.id,
      authUrl: lateData.authUrl 
    });

    return new Response(JSON.stringify({
      authUrl: lateData.authUrl,
      profileId,
      attemptId: attempt.id,
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
