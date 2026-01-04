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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    // Get the origin for redirect
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const projectId = supabaseUrl.split('.')[0].replace('https://', '');
    const origin = Deno.env.get('SITE_URL') || `https://${projectId}.lovableproject.com`;

    // Helper function to render close window page
    const renderClosePage = (success: boolean, message: string, accountName?: string) => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${success ? 'Conexão bem-sucedida!' : 'Erro na conexão'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      backdrop-filter: blur(10px);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 24px;
    }
    p {
      margin: 0;
      opacity: 0.8;
      font-size: 14px;
    }
    .account {
      margin-top: 15px;
      padding: 10px 20px;
      background: rgba(29, 161, 242, 0.2);
      border-radius: 8px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'X/Twitter conectado!' : 'Erro na conexão'}</h1>
    <p>${message}</p>
    ${accountName ? `<div class="account">@${accountName}</div>` : ''}
    <p style="margin-top: 20px; font-size: 12px;">Esta janela fechará automaticamente...</p>
  </div>
  <script>
    // Notify parent window
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'TWITTER_OAUTH_${success ? 'SUCCESS' : 'ERROR'}',
        ${success ? `accountName: '${accountName || ''}'` : `error: '${message}'`}
      }, '*');
    }
    // Close window after delay
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>`;
      return new Response(html, { 
        headers: { 'Content-Type': 'text/html' }
      });
    };

    if (error) {
      console.error('Twitter OAuth error:', error, errorDescription);
      return renderClosePage(false, errorDescription || error);
    }

    if (!code || !state) {
      return renderClosePage(false, 'Parâmetros ausentes na resposta do Twitter');
    }

    // Parse state: userId:clientId:timestamp:hash
    const stateParts = state.split(':');
    if (stateParts.length !== 4) {
      return renderClosePage(false, 'Estado inválido');
    }
    
    const [userId, clientId, timestamp, providedHash] = stateParts;
    
    // Validate timestamp (15 min expiry)
    const stateTime = parseInt(timestamp);
    if (Date.now() - stateTime > 15 * 60 * 1000) {
      return renderClosePage(false, 'Sessão expirada. Tente novamente.');
    }

    // Validate hash using HMAC
    const TWITTER_CLIENT_SECRET = Deno.env.get('TWITTER_CONSUMER_SECRET');
    const TWITTER_CLIENT_ID = Deno.env.get('TWITTER_CONSUMER_KEY');
    
    if (!TWITTER_CLIENT_SECRET || !TWITTER_CLIENT_ID) {
      console.error('Twitter credentials not configured');
      return renderClosePage(false, 'Erro de configuração do servidor');
    }
    
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
    const expectedHash = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, '');
    
    if (providedHash !== expectedHash.substring(0, 32)) {
      console.error('Invalid state hash');
      return renderClosePage(false, 'Estado de segurança inválido');
    }

    // Retrieve code verifier from database
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, supabaseServiceKey);

    const { data: credData, error: credError } = await supabase
      .from('client_social_credentials')
      .select('metadata')
      .eq('client_id', clientId)
      .eq('platform', 'twitter')
      .single();

    if (credError || !credData?.metadata?.code_verifier) {
      console.error('Code verifier not found:', credError);
      return renderClosePage(false, 'Sessão OAuth inválida. Tente novamente.');
    }

    const codeVerifier = credData.metadata.code_verifier;
    const redirectUri = `${SUPABASE_URL}/functions/v1/twitter-oauth-callback`;

    // Exchange code for tokens using Basic Auth
    const basicAuth = btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`);
    
    console.log('Exchanging code for tokens...');
    console.log('Redirect URI:', redirectUri);
    
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenResponseText = await tokenResponse.text();
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response:', tokenResponseText);

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponseText);
      let errorMsg = 'Falha ao obter tokens do Twitter';
      try {
        const errorJson = JSON.parse(tokenResponseText);
        errorMsg = errorJson.error_description || errorJson.error || errorMsg;
      } catch {}
      return renderClosePage(false, errorMsg);
    }

    const tokens = JSON.parse(tokenResponseText);
    console.log('Tokens received successfully, scopes:', tokens.scope);

    // Get user info using the access token
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    let accountId = null;
    let accountName = null;
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      if (userData.data) {
        accountId = userData.data.id;
        accountName = userData.data.username;
        console.log(`Twitter user found: @${accountName} (${accountId})`);
      }
    } else {
      console.error('Failed to get user info:', await userResponse.text());
    }

    // Calculate token expiration
    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Store tokens in database
    const { error: upsertError } = await supabase
      .from('client_social_credentials')
      .upsert({
        client_id: clientId,
        platform: 'twitter',
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        validation_error: null,
        account_name: accountName,
        account_id: accountId,
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        metadata: {
          scope: tokens.scope,
          token_type: tokens.token_type,
          connected_at: new Date().toISOString(),
          oauth_version: '2.0'
        }
      }, { onConflict: 'client_id,platform' });

    if (upsertError) {
      console.error('Error storing tokens:', upsertError);
      return renderClosePage(false, 'Erro ao salvar credenciais');
    }

    console.log('Twitter OAuth 2.0 completed successfully for client:', clientId);
    
    return renderClosePage(true, 'Conta conectada com sucesso!', accountName);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(`
<!DOCTYPE html>
<html>
<head><title>Erro</title></head>
<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a2e; color: white;">
  <div style="text-align: center;">
    <h1>❌ Erro inesperado</h1>
    <p>${error instanceof Error ? error.message : 'Erro desconhecido'}</p>
    <script>setTimeout(() => window.close(), 3000);</script>
  </div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html' } });
  }
});
