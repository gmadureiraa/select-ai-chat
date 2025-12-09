import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Get the origin for redirect
    const origin = Deno.env.get('SITE_URL') || 'https://preview--2c2f84a0-93bc-46b5-96a3-5c7eb43f1c4a.lovable.app';
    
    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${origin}/performance?error=oauth_denied`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${origin}/performance?error=missing_params`, 302);
    }

    // Parse state: userId:clientId:timestamp:hash
    const [userId, clientId, timestamp, providedHash] = state.split(':');
    
    // Validate timestamp (15 min expiry)
    const stateTime = parseInt(timestamp);
    if (Date.now() - stateTime > 15 * 60 * 1000) {
      return Response.redirect(`${origin}/performance?error=state_expired`, 302);
    }

    // Validate hash using HMAC
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!GOOGLE_CLIENT_SECRET) {
      console.error('GOOGLE_CLIENT_SECRET not configured');
      return Response.redirect(`${origin}/performance?error=config_error`, 302);
    }
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(GOOGLE_CLIENT_SECRET),
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
      return Response.redirect(`${origin}/performance?error=invalid_state`, 302);
    }

    // Exchange code for tokens
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    
    const redirectUri = `${SUPABASE_URL}/functions/v1/youtube-oauth-callback`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return Response.redirect(`${origin}/performance?error=token_exchange_failed`, 302);
    }

    const tokens = await tokenResponse.json();
    console.log('Tokens received successfully');

    // Get channel info using the access token
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      }
    );

    let channelId = null;
    let channelTitle = null;
    
    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      if (channelData.items && channelData.items.length > 0) {
        channelId = channelData.items[0].id;
        channelTitle = channelData.items[0].snippet.title;
        console.log(`Channel found: ${channelTitle} (${channelId})`);
      }
    }

    // Store tokens in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const { error: upsertError } = await supabase
      .from('youtube_tokens')
      .upsert({
        user_id: userId,
        client_id: clientId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        channel_id: channelId,
        channel_title: channelTitle,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,client_id' });

    if (upsertError) {
      console.error('Error storing tokens:', upsertError);
      return Response.redirect(`${origin}/performance?error=storage_failed`, 302);
    }

    console.log('YouTube OAuth completed successfully');
    
    // Redirect back to client performance page
    return Response.redirect(
      `${origin}/client/${clientId}/performance?channel=youtube&oauth=success`,
      302
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    const origin = Deno.env.get('SITE_URL') || 'https://preview--2c2f84a0-93bc-46b5-96a3-5c7eb43f1c4a.lovable.app';
    return Response.redirect(`${origin}/performance?error=unknown`, 302);
  }
});
