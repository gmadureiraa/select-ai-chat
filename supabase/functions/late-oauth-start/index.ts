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

    // STRATEGY: Each client gets their OWN Late profile for complete isolation
    // This prevents account mixing between clients
    
    // Check if this CLIENT already has a Late profile
    const { data: clientProfile } = await supabaseAdmin
      .from('client_social_credentials')
      .select('metadata, account_id')
      .eq('client_id', clientId)
      .eq('platform', 'late_profile')
      .single();

    let profileId = (clientProfile?.metadata as Record<string, unknown>)?.late_profile_id as string || clientProfile?.account_id;

    // Verify if the profile still exists in Late API
    if (profileId) {
      console.log("Verifying existing profile in Late API:", profileId);
      const checkProfileResponse = await fetch(`${LATE_API_BASE}/v1/profiles/${profileId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${LATE_API_KEY}`,
        },
      });

      if (checkProfileResponse.status === 404) {
        console.log("Profile not found in Late API, will create new one. Cleaning orphan data...");
        
        // Delete orphan late_profile reference
        await supabaseAdmin
          .from('client_social_credentials')
          .delete()
          .eq('client_id', clientId)
          .eq('platform', 'late_profile');
        
        // Also delete any social credentials linked to this orphan profile
        await supabaseAdmin
          .from('client_social_credentials')
          .delete()
          .eq('client_id', clientId)
          .not('platform', 'eq', 'late_profile');
        
        profileId = undefined as unknown as string; // Force creation of new profile
      }
    }

    // If client doesn't have a profile, try to create or find one
    if (!profileId) {
      console.log("Client has no Late profile, creating/finding one for:", clientId);
      
      // First, try to list existing profiles to see what's available
      const listProfilesResponse = await fetch(`${LATE_API_BASE}/v1/profiles`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${LATE_API_KEY}`,
        },
      });

      let existingProfiles: Array<{ _id: string; name: string }> = [];
      if (listProfilesResponse.ok) {
        const profilesData = await listProfilesResponse.json();
        existingProfiles = profilesData.profiles || [];
        console.log("Existing profiles:", existingProfiles.length);
      }

      // Check if there's already a profile for this client (by name pattern)
      const clientProfileName = `kai-${clientId.substring(0, 8)}`;
      const existingClientProfile = existingProfiles.find(p => p.name === clientProfileName);
      
      if (existingClientProfile) {
        profileId = existingClientProfile._id;
        console.log("Found existing profile for client:", { profileId, name: clientProfileName });
      } else {
        // Try to create a new profile for this client
        const createProfileResponse = await fetch(`${LATE_API_BASE}/v1/profiles`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LATE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: clientProfileName }),
        });

        if (createProfileResponse.ok) {
          const newProfile = await createProfileResponse.json();
          profileId = newProfile.profile._id;
          console.log("Created new profile for client:", { profileId, name: clientProfileName });
        } else {
          const errorText = await createProfileResponse.text();
          console.error("Failed to create Late profile:", errorText);
          
          // If profile limit reached, check if there's an unassigned profile we can use
          if (errorText.includes("Profile limit") && existingProfiles.length > 0) {
            // Find a profile not yet assigned to any client
            const { data: assignedProfiles } = await supabaseAdmin
              .from('client_social_credentials')
              .select('metadata')
              .eq('platform', 'late_profile');
            
            const assignedProfileIds = new Set(
              (assignedProfiles || []).map(p => 
                (p.metadata as Record<string, unknown>)?.late_profile_id
              ).filter(Boolean)
            );
            
            const unassignedProfile = existingProfiles.find(p => !assignedProfileIds.has(p._id));
            
            if (unassignedProfile) {
              profileId = unassignedProfile._id;
              console.log("Using unassigned profile for client:", { profileId, name: unassignedProfile.name });
            } else {
              // No unassigned profiles - user needs to upgrade Late plan
              return new Response(JSON.stringify({ 
                error: "Limite de perfis atingido. Para conectar mais perfis, considere fazer upgrade do plano Late API.",
                details: "Cada perfil precisa de uma conta separada para garantir isolamento." 
              }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } else if (!profileId) {
            return new Response(JSON.stringify({ 
              error: "Falha ao criar perfil para o cliente.",
              details: errorText 
            }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Save this profile as belonging to THIS client specifically
      if (profileId) {
        await supabaseAdmin
          .from('client_social_credentials')
          .upsert({
            client_id: clientId,
            platform: 'late_profile',
            account_id: profileId,
            account_name: clientProfileName,
            metadata: { late_profile_id: profileId, created_for_client: true },
            is_valid: true,
          }, {
            onConflict: 'client_id,platform',
          });
        console.log("Saved profile mapping for client:", { clientId, profileId });
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
