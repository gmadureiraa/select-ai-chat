// Verify JWT issued by Neon Auth (Stack Auth) using JWKS endpoint
// Replaces supabaseAuth.auth.getUser()
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { VercelRequest } from '@vercel/node';

const JWKS_URL = process.env.NEON_JWKS_URL || process.env.VITE_NEON_JWKS_URL;

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!JWKS_URL) {
    throw new Error('NEON_JWKS_URL / VITE_NEON_JWKS_URL not configured');
  }
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return _jwks;
}

export interface AuthUser {
  id: string;
  email?: string;
  raw: Record<string, any>;
}

/**
 * Internal bypass — only callable from inside the same Node runtime
 * (e.g. dev-test-flows handler). Header `x-internal-cron-secret` must match
 * env CRON_SECRET, and `x-internal-user-id` carries the user UUID to assume.
 *
 * NEVER trust this from public traffic — Vercel does not strip custom headers,
 * but the secret check makes forging this equivalent to knowing CRON_SECRET.
 */
function tryInternalBypass(req: VercelRequest): AuthUser | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;
  const headerSecret = req.headers['x-internal-cron-secret'];
  const headerUser = req.headers['x-internal-user-id'];
  const secretVal = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;
  const userVal = Array.isArray(headerUser) ? headerUser[0] : headerUser;
  if (secretVal !== cronSecret || !userVal) return null;
  return {
    id: userVal,
    email: undefined,
    raw: { sub: userVal, _internal_bypass: true },
  };
}

/**
 * Verify Bearer token from Authorization header.
 * Returns the user (sub claim → id) or throws.
 */
export async function verifyAuth(req: VercelRequest): Promise<AuthUser> {
  const bypass = tryInternalBypass(req);
  if (bypass) return bypass;

  const auth = req.headers.authorization || req.headers.Authorization;
  const headerVal = Array.isArray(auth) ? auth[0] : auth;
  if (!headerVal || !headerVal.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }
  const token = headerVal.slice(7);

  try {
    const { payload } = await jwtVerify(token, getJwks());
    const sub = (payload.sub || payload.user_id) as string | undefined;
    if (!sub) throw new Error('JWT missing sub claim');
    return {
      id: sub,
      email: (payload.email as string | undefined),
      raw: payload as Record<string, any>,
    };
  } catch (err: any) {
    throw new Error(`Invalid or expired token: ${err.message}`);
  }
}

/**
 * Optional auth: return user if header is valid, else null. Never throws.
 * Also honors the internal bypass header pair (used by dev-test-flows).
 */
export async function tryAuth(req: VercelRequest): Promise<AuthUser | null> {
  const bypass = tryInternalBypass(req);
  if (bypass) return bypass;
  try {
    return await verifyAuth(req);
  } catch {
    return null;
  }
}
