// Neon Auth (Better Auth) client — drop-in replacement for `supabase.auth`.
//
// Uses `@neondatabase/auth` with `SupabaseAuthAdapter` so the public API is
// 100% compatible with `@supabase/auth-js`: `signInWithPassword`, `signUp`,
// `signOut`, `getSession`, `getUser`, `onAuthStateChange`,
// `resetPasswordForEmail`, `signInWithOAuth`, `setSession`, `updateUser`,
// etc. No call-site refactor required for the legacy 45 supabase.auth.*
// usages in the app.
//
// The same adapter instance is wired into the Neon Data API client in
// `integrations/supabase/client.ts` so RLS policies (which read
// `auth.uid()`) keep working.
//
// Env vars expected:
//   - VITE_NEON_AUTH_URL   full base URL of the Neon Auth API
//                          (e.g. https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth)

import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";

const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;

if (!NEON_AUTH_URL) {
  console.warn(
    "[neon-auth] VITE_NEON_AUTH_URL is not set — auth calls will fail.",
  );
}

export const neonAuth = createAuthClient(NEON_AUTH_URL ?? "", {
  adapter: SupabaseAuthAdapter(),
});

/**
 * Returns the current user's JWT (access token) or null when signed out.
 * Used as the bearer token for Neon Data API (PostgREST) requests.
 *
 * O SupabaseAuthAdapter do @neondatabase/auth mapeia o session do Better Auth
 * pra shape Supabase: `{ data: { session: { access_token, ... } } }`.
 * O `session.token` original do Better Auth (JWT) vira `access_token`.
 */
export async function getNeonAuthJWT(): Promise<string | null> {
  try {
    const result = await neonAuth.getSession();
    const sessionAny = result?.data as any;
    // shape esperado: { session: { access_token, user, ... } }
    const token =
      sessionAny?.session?.access_token ??
      sessionAny?.session?.token ??
      sessionAny?.access_token ??
      sessionAny?.token ??
      null;
    if (!token && typeof window !== "undefined") {
      // Debug: log shape sem expor sensitive data
      // eslint-disable-next-line no-console
      console.debug("[neon-auth] no JWT in session", {
        hasData: !!result?.data,
        keys: result?.data ? Object.keys(result.data) : [],
        sessionKeys: sessionAny?.session ? Object.keys(sessionAny.session) : null,
      });
    }
    return token;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[neon-auth] getNeonAuthJWT failed:", err);
    return null;
  }
}
