// Migrated from supabase/functions/linkedin-oauth-callback/index.ts
// GET handler — receives ?code=...&state=... from LinkedIn and redirects to app.
// Defensive fallback: if env vars not configured, returns 503.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool } from '../_lib/db.js';

const REQUIRED_ENV = ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  const frontendUrl = process.env.FRONTEND_URL || 'https://kai.kaleidos.com.br';

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return res.status(503).json({
      error: 'LinkedIn integration not configured',
      missing_env: missing,
      hint: 'Add the missing env vars in Vercel and redeploy',
    });
  }

  const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    console.error('[linkedin-oauth-callback] OAuth error:', error, errorDescription);
    res.writeHead(302, {
      Location: `${frontendUrl}/kaleidos?linkedin_oauth=error&message=${encodeURIComponent(
        errorDescription || error
      )}`,
    });
    res.end();
    return;
  }

  if (!code || !state) {
    res.writeHead(302, {
      Location: `${frontendUrl}/kaleidos?linkedin_oauth=error&message=Missing+parameters`,
    });
    res.end();
    return;
  }

  try {
    // Decode state
    let stateData: any;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      throw new Error('Invalid state parameter');
    }

    const { userId, clientId, timestamp } = stateData;
    if (Date.now() - timestamp > 10 * 60 * 1000) {
      throw new Error('OAuth session expired');
    }

    const linkedInClientId = process.env.LINKEDIN_CLIENT_ID!;
    const linkedInClientSecret = process.env.LINKEDIN_CLIENT_SECRET!;

    const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
    const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
    const callbackUrl =
      process.env.LINKEDIN_REDIRECT_URI || `${proto}://${host}/api/linkedin-oauth-callback`;

    // Exchange code for tokens
    console.log('[linkedin-oauth-callback] Exchanging code for tokens...');
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 5184000; // Default 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Get user profile from LinkedIn
    console.log('[linkedin-oauth-callback] Fetching LinkedIn profile...');
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let accountName = 'LinkedIn User';
    let accountId = '';
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      accountName =
        profile.name ||
        `${profile.given_name || ''} ${profile.family_name || ''}`.trim() ||
        'LinkedIn User';
      accountId = profile.sub || '';
    }

    // Save credentials to client_social_credentials.
    // IMPORTANTE: `oauth_access_token_encrypted` precisa receber o token
    // já passado por `public.encrypt_social_token(plaintext)`. Antes esse
    // INSERT colocava o token CRU na coluna `*_encrypted`, e a função
    // `decrypt_social_token` retorna `text` as-is quando não tem prefix
    // `enc:` (fallback silencioso plaintext). Resultado: token vazava no
    // primeiro dump do DB. Migration 0017-encrypt (2026-01-12) já existe.
    const pool = getPool();
    await pool.query(
      `INSERT INTO client_social_credentials
        (client_id, platform, oauth_access_token_encrypted, expires_at, account_id, account_name, is_valid, last_validated_at, validation_error, metadata)
        VALUES ($1, 'linkedin', public.encrypt_social_token($2::text), $3, $4, $5, TRUE, NOW(), NULL, $6::jsonb)
       ON CONFLICT (client_id, platform) DO UPDATE SET
        oauth_access_token_encrypted = EXCLUDED.oauth_access_token_encrypted,
        expires_at = EXCLUDED.expires_at,
        account_id = EXCLUDED.account_id,
        account_name = EXCLUDED.account_name,
        is_valid = TRUE,
        last_validated_at = NOW(),
        validation_error = NULL,
        metadata = EXCLUDED.metadata`,
      [
        clientId,
        accessToken,
        expiresAt,
        accountId,
        accountName,
        JSON.stringify({ oauth_version: '2.0', connected_at: new Date().toISOString() }),
      ]
    );

    console.log('[linkedin-oauth-callback] Credentials saved successfully');

    res.writeHead(302, {
      Location: `${frontendUrl}/kaleidos?client=${clientId}&tab=edit&linkedin_oauth=success`,
    });
    res.end();
  } catch (err: any) {
    console.error('[linkedin-oauth-callback] Error:', err);
    const message = err?.message || 'Unknown error';
    res.writeHead(302, {
      Location: `${frontendUrl}/kaleidos?linkedin_oauth=error&message=${encodeURIComponent(message)}`,
    });
    res.end();
  }
}
