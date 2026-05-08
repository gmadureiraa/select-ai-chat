// Compatibility re-export — the original migration plan expected a hand-rolled
// shim mapping Stack Auth → supabase.auth. We ended up using
// `@neondatabase/auth` with `SupabaseAuthAdapter` instead, which already
// provides a 100% supabase-compatible surface. This file just re-exports
// that adapter so any straggler imports keep working.

import { neonAuth } from "./client";

export const neonAuthShim = neonAuth;
export type NeonAuthShim = typeof neonAuth;

// Type alias re-exported for legacy imports that referenced the old shim's
// hand-rolled user shape. We keep it intentionally loose because all
// callers use it for `id`, `email`, `user_metadata` etc., which the
// SupabaseAuthAdapter already returns in the standard supabase-js shape.
export type ShimSupabaseUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string | null;
};
