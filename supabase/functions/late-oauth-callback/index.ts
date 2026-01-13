import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Late API redirects back with query params containing the connection info
// For standard flow: ?connected={platform}&profileId={profileId}&username={username}
// For headless: different params based on platform
serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    
    // Get our custom params we added to redirect_url
    const clientId = url.searchParams.get("clientId");
    const platform = url.searchParams.get("platform");
    
    // Late API success params
    const connected = url.searchParams.get("connected");
    const profileId = url.searchParams.get("profileId");
    const username = url.searchParams.get("username");
    
    // Error params
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description") || url.searchParams.get("message");

    // Determine redirect base URL
    const baseRedirectUrl = "https://kai-kaleidos.lovable.app";

    // Check for OAuth errors
    if (error) {
      console.error("OAuth error:", error, errorDescription);
      const redirectUrl = `${baseRedirectUrl}/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent(errorDescription || error)}`;
      return Response.redirect(redirectUrl, 302);
    }

    if (!clientId || !platform) {
      const redirectUrl = `${baseRedirectUrl}/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent("Missing client or platform info")}`;
      return Response.redirect(redirectUrl, 302);
    }

    // For standard flow, Late redirects with connected={platform}
    if (!connected && !username) {
      console.log("No connection info received, waiting for user to complete OAuth");
      // This might be an intermediate step, show a waiting page
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head><title>Connecting...</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>Connecting to ${platform}...</h2>
            <p>Please complete the authorization in the popup window.</p>
            <script>
              // Check if we're in a popup
              if (window.opener) {
                window.close();
              } else {
                setTimeout(() => {
                  window.location.href = "${baseRedirectUrl}/kaleidos?client=${clientId}&tab=edit";
                }, 3000);
              }
            </script>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");
    if (!LATE_API_KEY) {
      const redirectUrl = `${baseRedirectUrl}/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent("Late API not configured")}`;
      return Response.redirect(redirectUrl, 302);
    }

    // Get account details from Late API
    const LATE_API_BASE = "https://getlate.dev/api";
    
    // Fetch accounts to get the newly connected account details
    const accountsResponse = await fetch(`${LATE_API_BASE}/v1/accounts?profileId=${profileId}`, {
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
      },
    });

    let accountData = null;
    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();
      // Find the account that matches the platform and username
      accountData = accountsData.accounts?.find((acc: { platform: string; username: string }) => 
        acc.platform === connected && (acc.username === username || !username)
      );
    }

    console.log("Late connection received:", { 
      platform: connected, 
      profileId,
      username,
      accountData: accountData ? { id: accountData._id, username: accountData.username } : null
    });

    // Store credentials in database
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { error: upsertError } = await supabase
      .from("client_social_credentials")
      .upsert({
        client_id: clientId,
        platform: platform,
        account_id: accountData?._id || username,
        account_name: accountData?.displayName || accountData?.username || username,
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        validation_error: null,
        metadata: {
          provider: "late",
          late_account_id: accountData?._id,
          late_profile_id: profileId,
          username: accountData?.username || username,
          display_name: accountData?.displayName,
          profile_picture: accountData?.profilePicture,
          connected_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "client_id,platform",
      });

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      const redirectUrl = `${baseRedirectUrl}/kaleidos?client=${clientId}&tab=edit&late_oauth=error&message=${encodeURIComponent("Failed to save credentials")}`;
      return Response.redirect(redirectUrl, 302);
    }

    // Success! Return HTML that closes the popup and notifies parent
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>Connected!</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>✅ ${platform} Connected Successfully!</h2>
          <p>You can close this window.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'late_oauth_success', 
                platform: '${platform}',
                clientId: '${clientId}'
              }, '*');
              setTimeout(() => window.close(), 1500);
            } else {
              setTimeout(() => {
                window.location.href = "${baseRedirectUrl}/kaleidos?client=${clientId}&tab=edit&late_oauth=success&platform=${platform}";
              }, 1500);
            }
          </script>
        </body>
      </html>
    `, {
      headers: { "Content-Type": "text/html" },
    });

  } catch (error) {
    console.error("Error in late-oauth-callback:", error);
    const redirectUrl = `https://kai-kaleidos.lovable.app/kaleidos?tab=clients&late_oauth=error&message=${encodeURIComponent("An unexpected error occurred")}`;
    return Response.redirect(redirectUrl, 302);
  }
});
