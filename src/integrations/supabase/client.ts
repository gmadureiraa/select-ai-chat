// Migrated 2026-05-07: Supabase Auth (Lovable) → Neon Auth (Better Auth).
//
// `supabase` keeps its name and export so the legacy 45 `supabase.auth.*`
// callsites continue to work unchanged. Internally:
//   - `supabase.auth` is the Neon Auth client built with
//     `@neondatabase/auth`'s `SupabaseAuthAdapter`. That adapter implements
//     the entire `@supabase/auth-js` surface (signIn, signUp, signOut,
//     onAuthStateChange, resetPasswordForEmail, etc.) so callers see no
//     behavior change.
//   - PostgREST requests go to the Neon Data API at `VITE_SUPABASE_URL`.
//     A custom `fetch` injects the current Neon Auth JWT into every
//     request as `Authorization: Bearer <jwt>` so RLS policies that read
//     `auth.uid()` work end-to-end.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { neonAuth, getNeonAuthJWT } from "../neon-auth/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
// Neon Data API doesn't require an anon key in the same way Supabase does —
// the JWT in the Authorization header is what authenticates each request.
// We still send `apikey` because PostgREST expects the header to exist.
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";

const fetchWithNeonAuth: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization")) {
    const jwt = await getNeonAuthJWT();
    if (jwt) headers.set("Authorization", `Bearer ${jwt}`);
  }
  if (!headers.has("apikey")) {
    // Use whichever is available; PostgREST just needs the header to exist.
    const jwt = SUPABASE_PUBLISHABLE_KEY || (await getNeonAuthJWT()) || "";
    headers.set("apikey", jwt);
  }
  return fetch(input, { ...init, headers });
};

const baseClient = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY || "anon",
  {
    auth: {
      // Neon Auth manages its own token store; disable Supabase's local one
      // so the two layers never fight over localStorage / cookies.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithNeonAuth,
    },
  },
);

// Override the `auth` namespace with the Neon Auth (SupabaseAuthAdapter)
// instance. The base auth client built by supabase-js still exists in
// memory but is not used.
type ClientWithNeonAuth = Omit<SupabaseClient<Database>, "auth"> & {
  auth: typeof neonAuth;
};

(baseClient as unknown as ClientWithNeonAuth).auth = neonAuth;

export const supabase = baseClient as unknown as ClientWithNeonAuth;
