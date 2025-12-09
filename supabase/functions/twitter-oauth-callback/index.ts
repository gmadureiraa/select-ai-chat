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
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Twitter OAuth error:", error);
      return redirectWithError("Autorização negada pelo usuário");
    }

    if (!code || !state) {
      return redirectWithError("Parâmetros inválidos");
    }

    // Decode and verify state
    let stateData;
    try {
      // Decode base64url
      const base64 = state.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
      stateData = JSON.parse(atob(padded));
    } catch {
      return redirectWithError("Estado inválido");
    }

    const { userId, clientId, timestamp, sig } = stateData;

    // Verify signature
    const TWITTER_OAUTH_SECRET = Deno.env.get("TWITTER_OAUTH_SECRET") || "kai-twitter-secret";
    const hmac = createHmac("sha256", TWITTER_OAUTH_SECRET);
    hmac.update(`${userId}:${clientId}:${timestamp}`);
    const expectedSig = hmac.digest("hex");

    if (sig !== expectedSig) {
      return redirectWithError("Assinatura inválida");
    }

    // Check timestamp (10 minute expiry)
    if (Date.now() - timestamp > 600000) {
      return redirectWithError("Sessão expirada");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get stored code verifier
    const { data: tokenData } = await supabaseAdmin
      .from("twitter_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .single();

    const codeVerifier = tokenData?.access_token;
    if (!codeVerifier || codeVerifier === "pending") {
      return redirectWithError("Verificador não encontrado");
    }

    // Exchange code for tokens
    const TWITTER_CLIENT_ID = Deno.env.get("TWITTER_CLIENT_ID");
    const TWITTER_CLIENT_SECRET = Deno.env.get("TWITTER_CLIENT_SECRET");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twitter-oauth-callback`;

    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return redirectWithError("Falha ao obter token");
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let username = null;
    let twitterId = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.data?.username;
      twitterId = userData.data?.id;
    }

    // Update token in database
    const { error: updateError } = await supabaseAdmin
      .from("twitter_tokens")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        twitter_id: twitterId,
        username,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("client_id", clientId);

    if (updateError) {
      console.error("Error updating token:", updateError);
      return redirectWithError("Erro ao salvar token");
    }

    console.log("Twitter OAuth completed for user:", userId);

    // Redirect back to app
    const appUrl = Deno.env.get("APP_URL") || "https://tkbsjtgrumhvwlxkmojg.lovableproject.com";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}/client/${clientId}/performance?channel=twitter&success=true`,
      },
    });
  } catch (error) {
    console.error("Twitter OAuth callback error:", error);
    return redirectWithError("Erro interno");
  }
});

function redirectWithError(message: string) {
  const appUrl = Deno.env.get("APP_URL") || "https://tkbsjtgrumhvwlxkmojg.lovableproject.com";
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appUrl}/clients?error=${encodeURIComponent(message)}`,
    },
  });
}
