import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate OAuth code format (should be alphanumeric)
function isValidOAuthCode(code: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(code) && code.length > 10 && code.length < 500;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    // Validate code presence and format
    if (!code) {
      console.error('OAuth callback missing code parameter');
      return new Response(
        JSON.stringify({ error: 'Código de autorização não fornecido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!isValidOAuthCode(code)) {
      console.error('Invalid OAuth code format');
      return new Response(
        JSON.stringify({ error: 'Código de autorização inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get environment variables
    const clientId = Deno.env.get('CLICKUP_CLIENT_ID');
    const clientSecret = Deno.env.get('CLICKUP_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret || !supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
      const errorText = await tokenResponse.text();
      console.error('ClickUp token exchange failed:', {
        status: tokenResponse.status,
        error: errorText,
      });
      
      return new Response(
        JSON.stringify({ error: 'Falha na autorização do ClickUp' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token in response');
      return new Response(
        JSON.stringify({ error: 'Token de acesso não recebido' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header in OAuth callback');
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed in OAuth callback:', userError);
      return new Response(
        JSON.stringify({ error: 'Token de autenticação inválido' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get workspace info with error handling
    let workspaceId = null;
    try {
      const workspacesResponse = await fetch('https://api.clickup.com/api/v2/team', {
        headers: {
          'Authorization': accessToken,
        },
      });

      if (workspacesResponse.ok) {
        const workspacesData = await workspacesResponse.json();
        workspaceId = workspacesData.teams?.[0]?.id || null;
      } else {
        console.warn('Failed to fetch ClickUp workspace info, continuing without it');
      }
    } catch (error) {
      console.warn('Error fetching workspace info:', error);
      // Continue without workspace info - not critical
    }

    // Store token in database with RLS protection
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
      console.error('Error storing ClickUp token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Falha ao salvar token do ClickUp' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('ClickUp OAuth completed successfully for user:', user.id);

    // Redirect back to the app
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${url.origin}/clients?clickup=connected`,
      },
    });
  } catch (error) {
    console.error('Unexpected error in clickup-oauth-callback:', error);
    
    // Never expose internal error details to client
    return new Response(
      JSON.stringify({ error: 'Ocorreu um erro durante a autorização' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});