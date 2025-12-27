import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const facebookAppId = Deno.env.get('FACEBOOK_APP_ID')!;
  const facebookAppSecret = Deno.env.get('FACEBOOK_APP_SECRET')!;

  // Helper to redirect back to app
  const redirectToApp = (clientId: string, success: boolean, message?: string) => {
    const baseUrl = supabaseUrl.replace('.supabase.co', '.lovable.app').replace('https://tkbsjtgrumhvwlxkmojg', 'https://kai-platform');
    const redirectUrl = new URL(`/clients/${clientId}/performance`, baseUrl);
    redirectUrl.searchParams.set('instagram_oauth', success ? 'success' : 'error');
    if (message) redirectUrl.searchParams.set('message', message);
    
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl.toString() }
    });
  };

  try {
    if (error) {
      console.error('OAuth error from Facebook:', error, errorDescription);
      throw new Error(errorDescription || error);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Validate state parameter
    const [stateBase64, signatureHex] = state.split('.');
    if (!stateBase64 || !signatureHex) {
      throw new Error('Invalid state format');
    }

    // Verify HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(facebookAppSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(stateBase64)
    );

    if (!isValid) {
      throw new Error('Invalid state signature');
    }

    const stateData = JSON.parse(atob(stateBase64));
    const { clientId, userId, timestamp } = stateData;

    // Check if state is not too old (1 hour)
    if (Date.now() - timestamp > 3600000) {
      throw new Error('State expired');
    }

    // Exchange code for access token
    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth-callback`;
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', facebookAppId);
    tokenUrl.searchParams.set('client_secret', facebookAppSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message || 'Failed to get access token');
    }

    const userAccessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 5183944; // ~60 days default

    console.log('Got user access token, fetching pages...');

    // Get user's Facebook Pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`
    );
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      throw new Error(pagesData.error.message || 'Failed to get Facebook pages');
    }

    let instagramBusinessId = null;
    let instagramUsername = null;
    let pageId = null;
    let pageAccessToken = null;

    // Find a page with connected Instagram Business account
    for (const page of pagesData.data || []) {
      const igResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igResponse.json();

      if (igData.instagram_business_account) {
        instagramBusinessId = igData.instagram_business_account.id;
        pageId = page.id;
        pageAccessToken = page.access_token;

        // Get Instagram username
        const igProfileResponse = await fetch(
          `https://graph.facebook.com/v18.0/${instagramBusinessId}?fields=username,name&access_token=${pageAccessToken}`
        );
        const igProfile = await igProfileResponse.json();
        instagramUsername = igProfile.username;
        
        console.log('Found Instagram Business account:', instagramUsername);
        break;
      }
    }

    if (!instagramBusinessId) {
      throw new Error('Nenhuma conta Instagram Business conectada encontrada. Conecte seu Instagram à uma Página do Facebook primeiro.');
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Save tokens to database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: upsertError } = await supabase
      .from('instagram_tokens')
      .upsert({
        user_id: userId,
        client_id: clientId,
        access_token: pageAccessToken,
        user_access_token: userAccessToken,
        page_id: pageId,
        instagram_business_id: instagramBusinessId,
        instagram_username: instagramUsername,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,user_id'
      });

    if (upsertError) {
      console.error('Error saving tokens:', upsertError);
      throw new Error('Failed to save Instagram credentials');
    }

    console.log('Instagram OAuth completed successfully for:', instagramUsername);

    return redirectToApp(clientId, true);
  } catch (err) {
    console.error('Instagram OAuth callback error:', err);
    
    // Try to extract clientId from state for redirect
    let clientId = 'unknown';
    try {
      if (state) {
        const [stateBase64] = state.split('.');
        const stateData = JSON.parse(atob(stateBase64));
        clientId = stateData.clientId;
      }
    } catch {}

    const message = err instanceof Error ? err.message : 'Unknown error';
    return redirectToApp(clientId, false, message);
  }
});
