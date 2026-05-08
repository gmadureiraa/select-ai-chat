// Migrated 2026-05-07: Lovable Cloud Auth → Neon Auth (Better Auth).
// `neonAuth.signInWithOAuth` exposes the supabase-style OAuth API via the
// `SupabaseAuthAdapter`, so we just delegate to it. We keep the same
// `lovable.auth.signInWithOAuth(provider, opts)` shape so existing callers
// (Login.tsx, SimpleSignup.tsx) keep working.

import { neonAuth } from "../neon-auth/client";

type OAuthProvider = "google" | "apple" | "github" | "microsoft" | string;

interface SignInWithOAuthOptions {
  /**
   * Where Neon Auth should send the user back to after a successful OAuth
   * round-trip. Defaults to the current origin.
   */
  redirect_uri?: string;
}

interface OAuthResult {
  redirected: boolean;
  error?: { message: string };
}

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: OAuthProvider,
      opts?: SignInWithOAuthOptions,
    ): Promise<OAuthResult> => {
      try {
        const { error } = await neonAuth.signInWithOAuth({
          provider: provider as Parameters<
            typeof neonAuth.signInWithOAuth
          >[0]["provider"],
          options: {
            redirectTo: opts?.redirect_uri ?? window.location.origin,
          },
        });
        if (error) {
          return { redirected: false, error: { message: error.message } };
        }
        // The adapter triggers a full-page redirect, so this typically
        // never resolves on the same execution context.
        return { redirected: true };
      } catch (e) {
        return {
          redirected: false,
          error: {
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    },
  },
};
