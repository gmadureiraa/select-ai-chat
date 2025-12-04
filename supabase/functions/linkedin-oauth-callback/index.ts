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

// Validate state hash to prevent state parameter spoofing
async function validateStateHash(userId: string, timestamp: number, providedHash: string): Promise<boolean> {
  const data = `${userId}:${timestamp}:linkedin_oauth`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  
  return providedHash === expectedHash;
}

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

    const defaultRedirect = "https://9c978e1c-b485-433f-8082-036390767d5a.lovableproject.com/social-publisher";

    if (error) {
      console.error("LinkedIn OAuth error:", error, errorDescription);
      return Response.redirect(`${defaultRedirect}?linkedin_error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code) {
      throw new Error("No authorization code provided");
    }

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      throw new Error("LinkedIn credentials not configured");
    }

    // Parse and validate state parameter
    // State format: userId|timestamp|hash|redirectUrl
    let userId: string | null = null;
    let redirectUrl = defaultRedirect;

    if (state) {
      const parts = state.split("|");
      if (parts.length >= 3) {
        const [stateUserId, timestampStr, hash, ...redirectParts] = parts;
        const timestamp = parseInt(timestampStr, 10);
        
        // Validate timestamp (state expires after 10 minutes)
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        if (isNaN(timestamp) || now - timestamp > maxAge) {
          console.error("OAuth state expired or invalid timestamp");
          return Response.redirect(`${defaultRedirect}?linkedin_error=${encodeURIComponent("OAuth session expired. Please try again.")}`);
        }

        // Validate hash to prevent state tampering
        const isValidHash = await validateStateHash(stateUserId, timestamp, hash);
        if (!isValidHash) {
          console.error("OAuth state hash validation failed - potential tampering detected");
          return Response.redirect(`${defaultRedirect}?linkedin_error=${encodeURIComponent("Security validation failed. Please try again.")}`);
        }

        userId = stateUserId;
        if (redirectParts.length > 0) {
          redirectUrl = redirectParts.join("|");
        }
        
        console.log("State validated successfully for user:", userId);
      }
    }

    if (!userId) {
      throw new Error("Could not identify user from state parameter");
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
    return Response.redirect(`${redirectUrl}?linkedin_connected=true`);

  } catch (error: any) {
    console.error("LinkedIn OAuth callback error:", error);
    return Response.redirect(`https://9c978e1c-b485-433f-8082-036390767d5a.lovableproject.com/social-publisher?linkedin_error=${encodeURIComponent(error.message)}`);
  }
});
