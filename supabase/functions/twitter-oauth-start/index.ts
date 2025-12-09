import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { clientId } = await req.json();
    if (!clientId) {
      throw new Error("Missing clientId");
    }

    const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID");
    const TWITTER_OAUTH_SECRET = Deno.env.get("TWITTER_OAUTH_SECRET") || "kai-twitter-secret";

    if (!TWITTER_CLIENT_ID) {
      throw new Error("Twitter OAuth not configured. Please add TWITTER_CLIENT_ID secret.");
    }

    // Create signed state to prevent CSRF
    const timestamp = Date.now();
    const stateData = `${user.id}:${clientId}:${timestamp}`;
    const hmac = createHmac("sha256", TWITTER_OAUTH_SECRET);
    hmac.update(stateData);
    const signature = hmac.digest("hex");
    const stateObj = {
      userId: user.id,
      clientId,
      timestamp,
      sig: signature,
    };
    const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // Twitter OAuth 2.0 PKCE flow
    const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeChallenge = btoa(String.fromCharCode(...hashArray))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Store code verifier for callback
    const { error: storeError } = await supabaseClient
      .from("twitter_tokens")
      .upsert({
        user_id: user.id,
        client_id: clientId,
        access_token: codeVerifier, // Temporarily store verifier
        refresh_token: "pending",
      }, {
        onConflict: "user_id,client_id",
      });

    if (storeError) {
      console.error("Error storing code verifier:", storeError);
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twitter-oauth-callback`;
    
    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", TWITTER_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "tweet.read users.read offline.access");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    console.log("Twitter OAuth URL generated for user:", user.id);

    return new Response(
      JSON.stringify({ url: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Twitter OAuth start error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
