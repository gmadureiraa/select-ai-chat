import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID");
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      console.error("LinkedIn OAuth error:", error, errorDescription);
      return Response.redirect(`${state || "https://9c978e1c-b485-433f-8082-036390767d5a.lovableproject.com"}/social-publisher?linkedin_error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code) {
      throw new Error("No authorization code provided");
    }

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      throw new Error("LinkedIn credentials not configured");
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${SUPABASE_URL}/functions/v1/linkedin-oauth-callback`,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log("LinkedIn token response status:", tokenResponse.status);

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("LinkedIn token error:", tokenData);
      throw new Error(tokenData.error_description || "Failed to get access token");
    }

    // Get user ID from state (JWT token)
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    // Try to get user from state (we pass the user ID in state)
    if (state && state.includes("|")) {
      const parts = state.split("|");
      userId = parts[0];
    }

    if (!userId) {
      // Try to decode from the authorization header
      if (authHeader) {
        const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
        if (user) {
          userId = user.id;
        }
      }
    }

    if (!userId) {
      throw new Error("Could not identify user");
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Store token in database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error: dbError } = await supabase
      .from("linkedin_tokens")
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to store token");
    }

    console.log("LinkedIn token stored for user:", userId);

    // Redirect back to app
    const redirectUrl = state?.split("|")[1] || "https://9c978e1c-b485-433f-8082-036390767d5a.lovableproject.com/social-publisher";
    return Response.redirect(`${redirectUrl}?linkedin_connected=true`);

  } catch (error: any) {
    console.error("LinkedIn OAuth callback error:", error);
    return Response.redirect(`https://9c978e1c-b485-433f-8082-036390767d5a.lovableproject.com/social-publisher?linkedin_error=${encodeURIComponent(error.message)}`);
  }
});
