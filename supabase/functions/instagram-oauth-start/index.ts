import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const facebookAppId = Deno.env.get('FACEBOOK_APP_ID');
    const facebookAppSecret = Deno.env.get('FACEBOOK_APP_SECRET');

    if (!facebookAppId || !facebookAppSecret) {
      console.error('Missing Facebook credentials:', { 
        hasAppId: !!facebookAppId, 
        hasAppSecret: !!facebookAppSecret 
      });
      throw new Error('Credenciais do Facebook/Meta não configuradas. Configure FACEBOOK_APP_ID e FACEBOOK_APP_SECRET nos secrets.');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    const { clientId } = await req.json();
    if (!clientId) {
      throw new Error('clientId is required');
    }

    // Verify user has access to this client
    const { data: hasAccess } = await supabase.rpc('client_workspace_accessible', {
      p_client_id: clientId,
      p_user_id: user.id
    });

    if (!hasAccess) {
      throw new Error('Access denied to this client');
    }

    // Generate state parameter for CSRF protection
    const stateData = {
      clientId,
      userId: user.id,
      timestamp: Date.now(),
    };
    
    const encoder = new TextEncoder();
    const stateJson = JSON.stringify(stateData);
    const stateBase64 = btoa(stateJson);
    
    // Create HMAC signature
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(facebookAppSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stateBase64));
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const state = `${stateBase64}.${signatureHex}`;

    // Build redirect URI
    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;

    // Facebook OAuth scopes for Instagram Business
    const scopes = [
      'instagram_basic',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
      'business_management'
    ].join(',');

    // Build authorization URL
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.set('client_id', facebookAppId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    console.log('Instagram OAuth started for client:', clientId);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Instagram OAuth start error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
