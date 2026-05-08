import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Verifica se o user logado é super_admin (entrada na tabela `super_admins`).
 *
 * Usa a RPC `is_super_admin(p_user_id)` se disponível, com fallback pra
 * query direta na tabela. Cacheia por 5min — esse status muda raramente.
 */
export function useSuperAdmin() {
  const { user } = useAuth();

  const { data: isSuperAdmin = false, isLoading } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      // Try RPC first (canonical check)
      const rpc = await supabase.rpc("is_super_admin", { p_user_id: user.id });
      if (!rpc.error && typeof rpc.data === "boolean") {
        return rpc.data;
      }

      // Fallback: direct table query
      const { data, error } = await supabase
        .from("super_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { isSuperAdmin, isLoading };
}
