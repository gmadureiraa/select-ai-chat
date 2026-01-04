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

// RFC 3986 percent encoding for OAuth
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

// Generate OAuth 1.0a signature for Twitter
// IMPORTANT: Do NOT include POST body parameters in the signature for Twitter API v2
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Sort parameters and create parameter string
  const sortedParams = Object.keys(params).sort();
  const paramString = sortedParams
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  
  // Create signature base string
  const signatureBaseString = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
  
  // Create signing key
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  
  // Generate HMAC-SHA1 signature
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");
  
  console.log("OAuth Debug - Parameter String:", paramString);
  console.log("OAuth Debug - Signature Base String:", signatureBaseString);
  
  return signature;
}

function generateOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  // Trim all credentials to remove any accidental whitespace
  const cleanApiKey = apiKey.trim();
  const cleanApiSecret = apiSecret.trim();
  const cleanAccessToken = accessToken.trim();
  const cleanAccessTokenSecret = accessTokenSecret.trim();
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: cleanApiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: cleanAccessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method, 
    url, 
    oauthParams, 
    cleanApiSecret, 
    cleanAccessTokenSecret
  );

  // Build OAuth header string
  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const oauthHeader = "OAuth " + Object.keys(headerParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
    .join(", ");
  
  console.log("OAuth Debug - Generated Header:", oauthHeader);
  
  return oauthHeader;
}

async function validateTwitterCredentials(credentials: ValidationRequest['credentials']): Promise<ValidationResult> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = credentials;
  
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return { isValid: false, error: 'Todas as credenciais do Twitter são obrigatórias (API Key, API Secret, Access Token, Access Token Secret)' };
  }

  try {
    const url = "https://api.x.com/2/users/me";
    const oauthHeader = generateOAuthHeader("GET", url, apiKey, apiSecret, accessToken, accessTokenSecret);

    console.log("Twitter API Request - URL:", url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    console.log("Twitter API Response Status:", response.status);
    console.log("Twitter API Response Body:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return { isValid: false, error: `Resposta inválida da API: ${responseText}` };
    }

    if (!response.ok) {
      console.error("Twitter validation error:", data);
      
      // Provide more helpful error messages
      if (response.status === 401) {
        return { 
          isValid: false, 
          error: 'Credenciais inválidas. Verifique se: 1) As chaves estão corretas, 2) O app tem permissão de "Read and Write", 3) OAuth 1.0a está habilitado no Twitter Developer Portal.' 
        };
      }
      if (response.status === 403) {
        return { 
          isValid: false, 
          error: 'Acesso negado. Verifique se o app tem as permissões necessárias no Twitter Developer Portal.' 
        };
      }
      
      return { 
        isValid: false, 
        error: data.detail || data.errors?.[0]?.message || `Erro ${response.status}: Credenciais inválidas` 
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
        Authorization: `Bearer ${oauthAccessToken.trim()}`,
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
        api_key: credentials.apiKey?.trim(),
        api_secret: credentials.apiSecret?.trim(),
        access_token: credentials.accessToken?.trim(),
        access_token_secret: credentials.accessTokenSecret?.trim(),
      } : {
        oauth_access_token: credentials.oauthAccessToken?.trim(),
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
