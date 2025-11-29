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

    if (!code) {
      throw new Error('No authorization code provided');
    }

    const clientId = Deno.env.get('CLICKUP_CLIENT_ID');
    const clientSecret = Deno.env.get('CLICKUP_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      throw new Error('ClickUp credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.clickup.com/api/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('ClickUp token exchange failed:', error);
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Get workspace info
    const workspacesResponse = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': accessToken,
      },
    });

    const workspacesData = await workspacesResponse.json();
    const workspaceId = workspacesData.teams?.[0]?.id || null;

    // Store token in database
    const { error: insertError } = await supabaseClient
      .from('clickup_tokens')
      .upsert({
        user_id: user.id,
        access_token: accessToken,
        workspace_id: workspaceId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (insertError) {
      console.error('Error storing token:', insertError);
      throw new Error('Failed to store ClickUp token');
    }

    // Redirect back to the app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${url.origin}/clients`,
      },
    });
  } catch (error) {
    console.error('Error in clickup-oauth-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});