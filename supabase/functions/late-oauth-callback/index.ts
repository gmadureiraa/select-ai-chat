import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Determine redirect base URL
    let baseRedirectUrl = "https://kai-kaleidos.lovable.app";

    // Decode state to get client info
    let stateData: { clientId: string; platform: string; userId: string; timestamp: number } | null = null;
    
    if (state) {
      try {
        stateData = JSON.parse(atob(state));
      } catch (e) {
        console.error("Failed to decode state:", e);
      }
    }

    // Check for OAuth errors
    if (error) {
      console.error("OAuth error:", error, errorDescription);
      const redirectUrl = `${baseRedirectUrl}/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent(errorDescription || error)}`;
      return Response.redirect(redirectUrl, 302);
    }

    if (!code || !stateData) {
      const redirectUrl = `${baseRedirectUrl}/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent("Missing authorization code or state")}`;
      return Response.redirect(redirectUrl, 302);
    }

    // Check if state is expired (10 minutes max)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      const redirectUrl = `${baseRedirectUrl}/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent("Session expired, please try again")}`;
      return Response.redirect(redirectUrl, 302);
    }

    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LATE_API_KEY) {
      const redirectUrl = `${baseRedirectUrl}/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent("Late API not configured")}`;
      return Response.redirect(redirectUrl, 302);
    }

    // Exchange code for access token via Late API
    const callbackUrl = `${supabaseUrl}/functions/v1/late-oauth-callback`;
    
    const tokenResponse = await fetch("https://api.getlate.dev/v1/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        redirect_uri: callbackUrl,
        provider: stateData.platform,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Late token exchange error:", tokenResponse.status, errorText);
      const redirectUrl = `${baseRedirectUrl}/kaleidos?client=${stateData.clientId}&tab=edit&late_oauth=error&message=${encodeURIComponent("Failed to exchange token")}`;
      return Response.redirect(redirectUrl, 302);
    }

    const tokenData = await tokenResponse.json();
    console.log("Late token received:", { 
      platform: stateData.platform, 
      accountId: tokenData.account_id,
      accountName: tokenData.account_name || tokenData.username 
    });

    // Store credentials in database
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { error: upsertError } = await supabase
      .from("client_social_credentials")
      .upsert({
        client_id: stateData.clientId,
        platform: stateData.platform,
        oauth_access_token: tokenData.access_token,
        oauth_refresh_token: tokenData.refresh_token || null,
        account_id: tokenData.account_id || tokenData.user_id,
        account_name: tokenData.account_name || tokenData.username || tokenData.display_name,
        expires_at: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        validation_error: null,
        metadata: {
          provider: "late",
          late_account_id: tokenData.account_id,
          connected_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "client_id,platform",
      });

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      const redirectUrl = `${baseRedirectUrl}/kaleidos?client=${stateData.clientId}&tab=edit&late_oauth=error&message=${encodeURIComponent("Failed to save credentials")}`;
      return Response.redirect(redirectUrl, 302);
    }

    // Success! Redirect back to client edit page
    const successUrl = `${baseRedirectUrl}/kaleidos?client=${stateData.clientId}&tab=edit&late_oauth=success&platform=${stateData.platform}`;
    return Response.redirect(successUrl, 302);

  } catch (error) {
    console.error("Error in late-oauth-callback:", error);
    const redirectUrl = `https://kai-kaleidos.lovable.app/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent("An unexpected error occurred")}`;
    return Response.redirect(redirectUrl, 302);
  }
});
