// Migrated from supabase/functions/twitter-oauth-start/index.ts
// Defensive fallback: if Twitter OAuth env vars not set, returns 503.
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { randomBytes, createHmac, createHash } from 'node:crypto';

const REQUIRED_ENV = ['TWITTER_CONSUMER_KEY', 'TWITTER_CONSUMER_SECRET'];

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  const hash = createHash('sha256').update(verifier).digest();
  return base64UrlEncode(hash);
}

export default authedPost(async ({ user, body, req, res }) => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    res.status(503).json({
      error: 'Twitter integration not configured',
      missing_env: missing,
      hint: 'Add the missing env vars (TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET) in Vercel and redeploy',
    });
    return;
  }

  const { clientId } = body || {};
  if (!clientId) {
    res.status(400).json({ error: 'clientId is required' });
    return;
  }
  // P0 fix audit 2026-05-16: aceitava clientId arbitrário e gravava
  // code_verifier no metadata daquele cliente alheio — atacante poderia
  // sequestrar próximo callback OAuth.
  await assertClientAccess(user.id, clientId);

  const userId = user.id;
  const TWITTER_CLIENT_ID = process.env.TWITTER_CONSUMER_KEY!;
  const TWITTER_CLIENT_SECRET = process.env.TWITTER_CONSUMER_SECRET!;

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Create secure state with HMAC
  const timestamp = Date.now().toString();
  const sig = createHmac('sha256', TWITTER_CLIENT_SECRET)
    .update(`${userId}:${clientId}:${timestamp}`)
    .digest('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 32);
  const state = `${userId}:${clientId}:${timestamp}:${sig}`;

  // Store the code verifier temporarily in DB
  await getPool().query(
    `INSERT INTO client_social_credentials (client_id, platform, is_valid, metadata)
     VALUES ($1, 'twitter', FALSE, $2::jsonb)
     ON CONFLICT (client_id, platform) DO UPDATE SET
       metadata = EXCLUDED.metadata, is_valid = FALSE`,
    [
      clientId,
      JSON.stringify({
        code_verifier: codeVerifier,
        oauth_state: state,
        oauth_started_at: new Date().toISOString(),
      }),
    ]
  );

  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
  const redirectUri =
    process.env.TWITTER_REDIRECT_URI || `${proto}://${host}/api/twitter-oauth-callback`;

  const scopes = 'tweet.read tweet.write users.read offline.access';

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', TWITTER_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log(`[twitter-oauth-start] URL generated for user ${userId}, client ${clientId}`);

  return { authUrl: authUrl.toString() };
});
