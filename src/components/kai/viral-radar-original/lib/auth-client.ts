/**
 * Auth client adapter — exporta a API que o standalone `lib/auth-client.ts`
 * provia (`useNeonSession`, `getJwtToken`, `isAuthConfigured`,
 * `signOutAndReset`) mas implementada em cima do `useAuth()` do KAI
 * (Supabase client). Assim os componentes copiados literalmente não
 * precisam ser mexidos.
 *
 * - useNeonSession() → mesmo shape `{ data: { user } | null, isPending }`
 * - getJwtToken() → pega token via supabase.auth.getSession()
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function isAuthConfigured(): boolean {
  return true;
}

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface SessionState {
  data: { user: SessionUser } | null;
  isPending: boolean;
}

export async function getJwtToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function useNeonSession(): SessionState & { refresh: () => void } {
  const [state, setState] = useState<SessionState>({
    data: null,
    isPending: true,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancel) return;
        const u = data.session?.user;
        if (u) {
          setState({
            data: {
              user: {
                id: u.id,
                email: u.email ?? "",
                name: (u.user_metadata?.full_name as string | undefined) ?? null,
              },
            },
            isPending: false,
          });
        } else {
          setState({ data: null, isPending: false });
        }
      } catch {
        if (!cancel) setState({ data: null, isPending: false });
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState({
          data: {
            user: {
              id: session.user.id,
              email: session.user.email ?? "",
              name: (session.user.user_metadata?.full_name as string | undefined) ?? null,
            },
          },
          isPending: false,
        });
      } else {
        setState({ data: null, isPending: false });
      }
    });

    return () => {
      cancel = true;
      subscription.unsubscribe();
    };
  }, [version]);

  return { ...state, refresh: () => setVersion((v) => v + 1) };
}

export async function signOutAndReset(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (key.startsWith("rdv_") || key.startsWith("rdv:")) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
}
