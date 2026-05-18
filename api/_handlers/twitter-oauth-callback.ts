// Migrated from supabase/functions/twitter-oauth-callback/index.ts
// GET handler — receives ?code=...&state=... from Twitter and renders close-window page.
// Defensive fallback: if Twitter OAuth env vars not set, returns 503.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

const REQUIRED_ENV = ['TWITTER_CONSUMER_KEY', 'TWITTER_CONSUMER_SECRET'];

function renderClosePage(success: boolean, message: string, accountName?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${success ? 'Conexão bem-sucedida!' : 'Erro na conexão'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; }
    .container { text-align: center; padding: 40px; background: rgba(255,255,255,0.1); border-radius: 16px; backdrop-filter: blur(10px); }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0; opacity: 0.8; font-size: 14px; }
    .account { margin-top: 15px; padding: 10px 20px; background: rgba(29, 161, 242, 0.2); border-radius: 8px; font-weight: 500; }
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
    if (window.opener) {
      try {
        window.opener.postMessage({
          type: 'TWITTER_OAUTH_${success ? 'SUCCESS' : 'ERROR'}',
          ${success ? `accountName: ${JSON.stringify(accountName || '')}` : `error: ${JSON.stringify(message)}`}
        }, '*');
      } catch(e) { console.error('postMessage failed', e); }
    }
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    res.status(503).json({
      error: 'Twitter integration not configured',
      missing_env: missing,
      hint: 'Add the missing env vars in Vercel and redeploy',
    });
    return;
  }

  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    if (error) {
      console.error('Twitter OAuth error:', error, errorDescription);
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(renderClosePage(false, errorDescription || error));
      return;
    }

    if (!code || !state) {
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(renderClosePage(false, 'Parâmetros ausentes na resposta do Twitter'));
      return;
    }

    // Parse state: userId:clientId:timestamp:hash
    const stateParts = state.split(':');
    if (stateParts.length !== 4) {
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(renderClosePage(false, 'Estado inválido'));
      return;
    }
    const [userId, clientId, timestamp, providedHash] = stateParts;

    // Validate timestamp (15 min expiry)
    const stateTime = parseInt(timestamp);
    if (Date.now() - stateTime > 15 * 60 * 1000) {
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(renderClosePage(false, 'Sessão expirada. Tente novamente.'));
      return;
    }

    const TWITTER_CLIENT_ID = process.env.TWITTER_CONSUMER_KEY!;
    const TWITTER_CLIENT_SECRET = process.env.TWITTER_CONSUMER_SECRET!;

    // Validate hash using HMAC
    const expectedHash = createHmac('sha256', TWITTER_CLIENT_SECRET)
      .update(`${userId}:${clientId}:${timestamp}`)
      .digest('base64')
      .replace(/[+/=]/g, '')
      .substring(0, 32);

    // 2026-05-18 audit fix: == era vulnerável a timing attack. timingSafeEqual
    // exige buffers do mesmo tamanho — fast path se length diferente.
    const hashMatch =
      providedHash.length === expectedHash.length &&
      (() => {
        try {
          return timingSafeEqual(Buffer.from(providedHash), Buffer.from(expectedHash));
        } catch {
          return false;
        }
      })();
    if (!hashMatch) {
      console.error('Invalid state hash');
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(renderClosePage(false, 'Estado de segurança inválido'));
      return;
    }

    // Retrieve code verifier from database
    const credData = await queryOne<any>(
      `SELECT metadata FROM client_social_credentials WHERE client_id = $1 AND platform = 'twitter' LIMIT 1`,
      [clientId]
    );

    const codeVerifier = (credData?.metadata as any)?.code_verifier;
    if (!codeVerifier) {
      console.error('Code verifier not found for client', clientId);
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(renderClosePage(false, 'Sessão OAuth inválida. Tente novamente.'));
      return;
    }

    const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
    const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
    const redirectUri =
      process.env.TWITTER_REDIRECT_URI || `${proto}://${host}/api/twitter-oauth-callback`;

    // Exchange code for tokens using Basic Auth
    const basicAuth = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString(
      'base64'
    );

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenResponseText = await tokenResponse.text();
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponseText);
      let errorMsg = 'Falha ao obter tokens do Twitter';
      try {
        const j = JSON.parse(tokenResponseText);
        errorMsg = j.error_description || j.error || errorMsg;
      } catch {}
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(renderClosePage(false, errorMsg));
      return;
    }

    const tokens = JSON.parse(tokenResponseText);

    // Get user info
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let accountId: string | null = null;
    let accountName: string | null = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      if (userData.data) {
        accountId = userData.data.id;
        accountName = userData.data.username;
      }
    } else {
      console.error('Failed to get user info:', await userResponse.text());
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // IMPORTANTE: passar tokens por `public.encrypt_social_token` antes do
    // INSERT. As colunas `*_encrypted` esperam ciphertext com prefix `enc:`
    // — `decrypt_social_token` retorna as-is quando não tem o marker,
    // fallback silencioso que mascarava plaintext em prod.
    await getPool().query(
      `INSERT INTO client_social_credentials
        (client_id, platform, is_valid, last_validated_at, validation_error, account_name, account_id, oauth_access_token_encrypted, oauth_refresh_token_encrypted, expires_at, metadata)
        VALUES ($1, 'twitter', TRUE, NOW(), NULL, $2, $3, public.encrypt_social_token($4::text), public.encrypt_social_token($5::text), $6, $7::jsonb)
       ON CONFLICT (client_id, platform) DO UPDATE SET
        is_valid = TRUE,
        last_validated_at = NOW(),
        validation_error = NULL,
        account_name = EXCLUDED.account_name,
        account_id = EXCLUDED.account_id,
        oauth_access_token_encrypted = EXCLUDED.oauth_access_token_encrypted,
        oauth_refresh_token_encrypted = EXCLUDED.oauth_refresh_token_encrypted,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata`,
      [
        clientId,
        accountName,
        accountId,
        tokens.access_token,
        tokens.refresh_token || null,
        expiresAt,
        JSON.stringify({
          scope: tokens.scope,
          token_type: tokens.token_type,
          connected_at: new Date().toISOString(),
          oauth_version: '2.0',
        }),
      ]
    );

    console.log('Twitter OAuth completed for client:', clientId);
    res.setHeader('Content-Type', 'text/html');
    res
      .status(200)
      .send(renderClosePage(true, 'Conta conectada com sucesso!', accountName || undefined));
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    res.setHeader('Content-Type', 'text/html');
    res
      .status(200)
      .send(
        renderClosePage(false, err instanceof Error ? err.message : 'Erro desconhecido')
      );
  }
}
