import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a random code verifier for PKCE
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Base64 URL encode (without padding)
function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Generate code challenge from code verifier using SHA-256
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    
    // Parse request body for clientId
    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this client via workspace membership
    const { data: clientAccess, error: accessError } = await supabase
      .rpc('client_workspace_accessible', { 
        p_client_id: clientId, 
        p_user_id: userId 
      });

    if (accessError || !clientAccess) {
      console.error('Client access check failed:', accessError);
      return new Response(
        JSON.stringify({ error: 'Access denied to this client' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twitter OAuth 2.0 credentials (these are the same as Consumer Key/Secret in Developer Portal)
    const TWITTER_CLIENT_ID = Deno.env.get('TWITTER_CONSUMER_KEY');
    const TWITTER_CLIENT_SECRET = Deno.env.get('TWITTER_CONSUMER_SECRET');

    if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
      console.error('Twitter OAuth not configured');
      return new Response(
        JSON.stringify({ error: 'Twitter OAuth not configured. Configure TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Create secure state with HMAC
    const timestamp = Date.now().toString();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(TWITTER_CLIENT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${userId}:${clientId}:${timestamp}`)
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, '').substring(0, 32);
    
    const state = `${userId}:${clientId}:${timestamp}:${hash}`;

    // Store the code verifier temporarily in the database
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: storeError } = await supabaseAdmin
      .from('client_social_credentials')
      .upsert({
        client_id: clientId,
        platform: 'twitter',
        is_valid: false,
        metadata: { 
          code_verifier: codeVerifier,
          oauth_state: state,
          oauth_started_at: new Date().toISOString()
        }
      }, { onConflict: 'client_id,platform' });

    if (storeError) {
      console.error('Error storing code verifier:', storeError);
      return new Response(
        JSON.stringify({ error: 'Failed to initialize OAuth flow' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/twitter-oauth-callback`;
    
    // Twitter OAuth 2.0 scopes - tweet.read, tweet.write, users.read, offline.access (for refresh token)
    const scopes = 'tweet.read tweet.write users.read offline.access';

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', TWITTER_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log(`Generated Twitter OAuth 2.0 URL for user ${userId}, client ${clientId}`);
    console.log(`Redirect URI: ${redirectUri}`);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate OAuth URL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
