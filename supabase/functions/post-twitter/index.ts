import { createHmac } from "node:crypto";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");
  return signature;
}

function generateOAuthHeader(method: string, url: string, credentials: TwitterCredentials): string {
  const oauthParams = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    credentials.apiSecret,
    credentials.accessTokenSecret
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    "OAuth " +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

const BASE_URL = "https://api.x.com/2";

async function sendTweet(tweetText: string, credentials: TwitterCredentials): Promise<any> {
  const url = `${BASE_URL}/tweets`;
  const method = "POST";

  const oauthHeader = generateOAuthHeader(method, url, credentials);
  console.log("Sending tweet:", tweetText.substring(0, 50) + "...");

  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: tweetText }),
  });

  const responseText = await response.text();
  console.log("Twitter API response status:", response.status);

  if (!response.ok) {
    console.error("Twitter API error:", responseText);
    throw new Error(`Twitter API error: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Verify the JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid or expired token");
    }

    const { content, clientId, clientName } = await req.json();
    
    if (!content) {
      throw new Error("Content is required");
    }

    if (!clientId) {
      throw new Error("Client ID is required");
    }

    console.log(`Publishing tweet for client: ${clientName || clientId}, user: ${user.id}`);

    // Get the user's Twitter OAuth credentials from twitter_tokens table
    const { data: tokenData, error: tokenError } = await supabase
      .from("twitter_tokens")
      .select("access_token, twitter_api_key, twitter_api_secret")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token fetch error:", tokenError);
      throw new Error("Twitter não conectado para este cliente. Por favor, conecte sua conta Twitter nas configurações.");
    }

    // Validate that we have all required credentials
    if (!tokenData.twitter_api_key || !tokenData.twitter_api_secret || !tokenData.access_token) {
      throw new Error("Credenciais do Twitter incompletas. Por favor, reconecte sua conta Twitter.");
    }

    // For OAuth 1.0a, we need both the API credentials and the user's access token
    // The access_token from OAuth flow contains both token and secret separated by a delimiter
    // or they might be stored separately depending on your OAuth implementation
    const accessTokenParts = tokenData.access_token.split(":");
    const accessToken = accessTokenParts[0];
    const accessTokenSecret = accessTokenParts[1] || accessTokenParts[0]; // Fallback if not separated

    const credentials: TwitterCredentials = {
      apiKey: tokenData.twitter_api_key,
      apiSecret: tokenData.twitter_api_secret,
      accessToken: accessToken,
      accessTokenSecret: accessTokenSecret,
    };

    const result = await sendTweet(content, credentials);
    
    console.log("Tweet published successfully:", result.data?.id);

    return new Response(JSON.stringify({
      success: true,
      platform: "twitter",
      postId: result.data?.id,
      message: "Tweet publicado com sucesso!"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Error posting to Twitter:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
