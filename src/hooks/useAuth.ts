import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, AuthError } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
