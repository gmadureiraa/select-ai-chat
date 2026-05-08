// Migrated from supabase/functions/validate-social-credentials/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { createHmac } from 'node:crypto';

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function generateOAuthSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
  const sortedParams = Object.keys(params).sort();
  const paramString = sortedParams.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const base = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac('sha1', key).update(base).digest('base64');
}

function generateOAuthHeader(method: string, url: string, apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey.trim(),
    oauth_nonce: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken.trim(),
    oauth_version: '1.0',
  };
  const sig = generateOAuthSignature(method, url, oauthParams, apiSecret.trim(), accessTokenSecret.trim());
  const headerParams = { ...oauthParams, oauth_signature: sig };
  return 'OAuth ' + Object.keys(headerParams).sort().map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`).join(', ');
}

async function validateTwitter(c: any) {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = c;
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return { isValid: false, error: 'Todas as credenciais do Twitter são obrigatórias' };
  }
  try {
    const url = 'https://api.twitter.com/2/users/me';
    const oauthHeader = generateOAuthHeader('GET', url, apiKey, apiSecret, accessToken, accessTokenSecret);
    const r = await fetch(url, { method: 'GET', headers: { Authorization: oauthHeader } });
    const text = await r.text();
    let data: any;
    try { data = JSON.parse(text); } catch { return { isValid: false, error: `Resposta inválida da API: ${text}` }; }
    if (!r.ok) {
      if (r.status === 401) return { isValid: false, error: 'Credenciais inválidas. Verifique chaves e permissões "Read and Write".' };
      if (r.status === 403) return { isValid: false, error: 'Acesso negado. Verifique permissões no Twitter Developer Portal.' };
      return { isValid: false, error: data.detail || data.errors?.[0]?.message || `Erro ${r.status}` };
    }
    return { isValid: true, accountName: data.data?.username || data.data?.name, accountId: data.data?.id };
  } catch (e: any) {
    return { isValid: false, error: `Erro de conexão: ${e.message}` };
  }
}

async function validateLinkedIn(c: any) {
  const { oauthAccessToken } = c;
  if (!oauthAccessToken) return { isValid: false, error: 'Token de acesso do LinkedIn é obrigatório' };
  try {
    const r = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${oauthAccessToken.trim()}` } });
    if (!r.ok) return { isValid: false, error: 'Token de acesso inválido ou expirado' };
    const data = await r.json();
    return { isValid: true, accountName: data.name || `${data.given_name} ${data.family_name}`, accountId: data.sub };
  } catch (e: any) {
    return { isValid: false, error: `Erro de conexão: ${e.message}` };
  }
}

export default authedPost(async ({ body }) => {
  const { clientId, platform, credentials } = body;
  let result: any;
  if (platform === 'twitter') result = await validateTwitter(credentials);
  else if (platform === 'linkedin') result = await validateLinkedIn(credentials);
  else throw new Error('Plataforma não suportada');

  // Upsert credentials
  const data: Record<string, any> = {
    client_id: clientId,
    platform,
    is_valid: result.isValid,
    last_validated_at: new Date().toISOString(),
    validation_error: result.error || null,
    account_name: result.accountName || null,
    account_id: result.accountId || null,
  };
  if (platform === 'twitter') {
    data.api_key_encrypted = credentials.apiKey?.trim();
    data.api_secret_encrypted = credentials.apiSecret?.trim();
    data.access_token_encrypted = credentials.accessToken?.trim();
    data.access_token_secret_encrypted = credentials.accessTokenSecret?.trim();
  } else {
    data.oauth_access_token_encrypted = credentials.oauthAccessToken?.trim();
  }

  const keys = Object.keys(data);
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const updates = keys.filter((k) => k !== 'client_id' && k !== 'platform').map((k) => `"${k}" = EXCLUDED."${k}"`).join(', ');
  const sql = `INSERT INTO client_social_credentials (${cols}) VALUES (${placeholders})
               ON CONFLICT (client_id, platform) DO UPDATE SET ${updates}`;
  await getPool().query(sql, keys.map((k) => data[k]));

  return result;
});
