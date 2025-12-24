import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  clientId: string;
  platform: 'twitter' | 'linkedin';
  credentials: {
    // Twitter
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessTokenSecret?: string;
    // LinkedIn
    oauthAccessToken?: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  accountName?: string;
  accountId?: string;
  error?: string;
}

// Generate OAuth 1.0a signature for Twitter
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
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return "OAuth " + Object.entries(signedOAuthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

async function validateTwitterCredentials(credentials: ValidationRequest['credentials']): Promise<ValidationResult> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = credentials;
  
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return { isValid: false, error: 'Todas as credenciais do Twitter são obrigatórias' };
  }

  try {
    const url = "https://api.x.com/2/users/me";
    const oauthHeader = generateOAuthHeader("GET", url, apiKey, apiSecret, accessToken, accessTokenSecret);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twitter validation error:", data);
      return { 
        isValid: false, 
        error: data.detail || data.errors?.[0]?.message || 'Credenciais inválidas' 
      };
    }

    return {
      isValid: true,
      accountName: data.data?.username || data.data?.name,
      accountId: data.data?.id,
    };
  } catch (error: unknown) {
    console.error("Twitter validation exception:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return { isValid: false, error: `Erro de conexão: ${message}` };
  }
}

async function validateLinkedInCredentials(credentials: ValidationRequest['credentials']): Promise<ValidationResult> {
  const { oauthAccessToken } = credentials;
  
  if (!oauthAccessToken) {
    return { isValid: false, error: 'Token de acesso do LinkedIn é obrigatório' };
  }

  try {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LinkedIn validation error:", errorText);
      return { isValid: false, error: 'Token de acesso inválido ou expirado' };
    }

    const data = await response.json();
    
    return {
      isValid: true,
      accountName: data.name || `${data.given_name} ${data.family_name}`,
      accountId: data.sub,
    };
  } catch (error: unknown) {
    console.error("LinkedIn validation exception:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return { isValid: false, error: `Erro de conexão: ${message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { clientId, platform, credentials } = await req.json() as ValidationRequest;

    console.log(`Validating ${platform} credentials for client ${clientId}`);

    let result: ValidationResult;

    if (platform === 'twitter') {
      result = await validateTwitterCredentials(credentials);
    } else if (platform === 'linkedin') {
      result = await validateLinkedInCredentials(credentials);
    } else {
      return new Response(JSON.stringify({ error: 'Plataforma não suportada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save or update credentials in database
    const credentialData = {
      client_id: clientId,
      platform,
      is_valid: result.isValid,
      last_validated_at: new Date().toISOString(),
      validation_error: result.error || null,
      account_name: result.accountName || null,
      account_id: result.accountId || null,
      ...(platform === 'twitter' ? {
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
        access_token: credentials.accessToken,
        access_token_secret: credentials.accessTokenSecret,
      } : {
        oauth_access_token: credentials.oauthAccessToken,
      }),
    };

    const { error: upsertError } = await supabaseClient
      .from('client_social_credentials')
      .upsert(credentialData, { onConflict: 'client_id,platform' });

    if (upsertError) {
      console.error("Error saving credentials:", upsertError);
      return new Response(JSON.stringify({ error: 'Erro ao salvar credenciais' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("Validation error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
