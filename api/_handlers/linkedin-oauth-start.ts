// Migrated from supabase/functions/linkedin-oauth-start/index.ts
// Defensive fallback: if env vars not configured, returns 503 with clear message.
import { authedPost } from '../_lib/handler.js';

const REQUIRED_ENV = ['LINKEDIN_CLIENT_ID'];

export default authedPost(async ({ user, body, req, res }) => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    res.status(503).json({
      error: 'LinkedIn integration not configured',
      missing_env: missing,
      hint: 'Add the missing env vars in Vercel and redeploy',
    });
    return;
  }

  const { clientId } = body || {};
  if (!clientId) {
    res.status(400).json({ error: 'clientId is required' });
    return;
  }

  const linkedInClientId = process.env.LINKEDIN_CLIENT_ID!;

  // Generate state with user info for callback verification
  const state = Buffer.from(
    JSON.stringify({ userId: user.id, clientId, timestamp: Date.now() })
  ).toString('base64');

  // LinkedIn OAuth 2.0 scopes for posting
  const scopes = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

  // Callback URL — points to this Vercel deployment
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
  const callbackUrl =
    process.env.LINKEDIN_REDIRECT_URI || `${proto}://${host}/api/linkedin-oauth-callback`;

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', linkedInClientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes);

  console.log('[linkedin-oauth-start] Generated auth URL for client:', clientId);

  return { authUrl: authUrl.toString(), callbackUrl };
});
