import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, AuthError } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { apiInvoke } from "@/lib/apiInvoke";

/**
 * Garante que o user tem row em `profiles` + workspace membership.
 * Substitui o trigger `on_auth_user_created` (que apontava pra
 * `auth.users` Supabase e nunca disparou em Neon Auth).
 *
 * Idempotente — backend faz UPSERT por (id) e INSERT condicional em
 * workspace_members. Fire-and-forget; falha é silenciosa.
 */
async function syncProfileBestEffort(): Promise<void> {
  try {
    await apiInvoke("sync-profile", { body: {} });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[useAuth] sync-profile failed:", err);
  }
}

/**
 * Hook de autenticação — agora rodando em cima de Neon Auth (Better Auth)
 * via `@neondatabase/auth` com `SupabaseAuthAdapter`. A API é compatível
 * com o que o resto do app já consome (`user.id`, `user.email`, etc.) e
 * `supabase.auth.*` continua funcionando porque o adapter expõe a mesma
 * superfície do `@supabase/auth-js`.
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Sessão inicial.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Reage a sign-in / sign-out (incluindo OAuth round-trip).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Sincroniza profiles + workspace_members em qualquer evento de
      // login (signed_in / token_refreshed / user_updated). Idempotente.
      if (
        session?.user &&
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")
      ) {
        void syncProfileBestEffort();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      toast({
        title: "Conta criada!",
        description: "Você já pode acessar o sistema.",
      });

      return { data, error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Erro ao criar conta",
        description: authError.message,
        variant: "destructive",
      });
      return { data: null, error: authError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso.",
      });

      return { data, error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Erro ao fazer login",
        description: authError.message,
        variant: "destructive",
      });
      return { data: null, error: authError };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout",
        description: "Até logo!",
      });
      navigate("/login");
    } catch {
      toast({
        title: "Erro ao sair",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };
};
