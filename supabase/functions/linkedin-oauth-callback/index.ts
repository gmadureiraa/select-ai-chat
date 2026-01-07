import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Get frontend URL for redirects
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://kaleidos.lovable.app';

  if (error) {
    console.error('[linkedin-oauth-callback] OAuth error:', error, errorDescription);
    return Response.redirect(`${frontendUrl}/kaleidos?linkedin_oauth=error&message=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code || !state) {
    console.error('[linkedin-oauth-callback] Missing code or state');
    return Response.redirect(`${frontendUrl}/kaleidos?linkedin_oauth=error&message=Missing+parameters`);
  }

  try {
    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      throw new Error('Invalid state parameter');
    }

    const { userId, clientId, timestamp } = stateData;

    // Verify timestamp (max 10 minutes)
    if (Date.now() - timestamp > 10 * 60 * 1000) {
      throw new Error('OAuth session expired');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const linkedInClientId = Deno.env.get('LINKEDIN_CLIENT_ID');
    const linkedInClientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');

    if (!linkedInClientId || !linkedInClientSecret) {
      throw new Error('LinkedIn credentials not configured');
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/linkedin-oauth-callback`;

    // Exchange code for tokens
    console.log('[linkedin-oauth-callback] Exchanging code for tokens...');
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: linkedInClientId,
        client_secret: linkedInClientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[linkedin-oauth-callback] Token exchange failed:', errorText);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokenData = await tokenResponse.json();
    console.log('[linkedin-oauth-callback] Token received, expires in:', tokenData.expires_in);

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 5184000; // Default 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Get user profile from LinkedIn
    console.log('[linkedin-oauth-callback] Fetching LinkedIn profile...');
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    let accountName = 'LinkedIn User';
    let accountId = '';

    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      accountName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || 'LinkedIn User';
      accountId = profile.sub || '';
      console.log('[linkedin-oauth-callback] Profile loaded:', accountName);
    } else {
      console.warn('[linkedin-oauth-callback] Could not fetch profile, using defaults');
    }

    // Save credentials to client_social_credentials
    const { error: upsertError } = await supabase
      .from('client_social_credentials')
      .upsert({
        client_id: clientId,
        platform: 'linkedin',
        oauth_access_token: accessToken,
        expires_at: expiresAt,
        account_id: accountId,
        account_name: accountName,
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        validation_error: null,
        metadata: {
          oauth_version: '2.0',
          connected_at: new Date().toISOString(),
        }
      }, {
        onConflict: 'client_id,platform'
      });

    if (upsertError) {
      console.error('[linkedin-oauth-callback] Failed to save credentials:', upsertError);
      throw new Error('Failed to save credentials');
    }

    console.log('[linkedin-oauth-callback] Credentials saved successfully');

    // Redirect back to frontend with success
    return Response.redirect(`${frontendUrl}/kaleidos?client=${clientId}&tab=edit&linkedin_oauth=success`);
  } catch (error: unknown) {
    console.error('[linkedin-oauth-callback] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.redirect(`${frontendUrl}/kaleidos?linkedin_oauth=error&message=${encodeURIComponent(message)}`);
  }
});
