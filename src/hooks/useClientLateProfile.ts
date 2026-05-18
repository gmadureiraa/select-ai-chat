// useClientLateProfile
//
// Read + create the Late/Zernio "profile" (= brand bucket) attached to a KAI
// client. Profile is stored in `client_social_credentials` row with
// `platform='late_profile'` (canonical pattern shared by late-oauth-start,
// late-inbox, late-analytics, late-disconnect-account).
//
// Use cases:
//   - Detect whether a client already has a Late profile (gate "Connect OAuth"
//     CTAs in SocialIntegrationsPanel).
//   - Create the profile explicitly via UI ("Criar profile" button) — calls
//     the `late-create-brand` handler.
//   - Recreate (force=true) when admin needs to reset.
//
// Returns `{ profileId, profileName, isLoading, createBrand, isCreating }`.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { apiInvoke } from "@/lib/apiInvoke";

export interface ClientLateProfile {
  profileId: string | null;
  profileName: string | null;
  createdAt: string | null;
  isValid: boolean;
}

export function useClientLateProfile(clientId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = ["client-late-profile", clientId];

  const { data, isLoading, refetch } = useQuery<ClientLateProfile>({
    queryKey,
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) {
        return { profileId: null, profileName: null, createdAt: null, isValid: false };
      }

      const { data: row, error } = await supabase
        .from("client_social_credentials")
        .select("account_id, account_name, metadata, is_valid")
        .eq("client_id", clientId)
        .eq("platform", "late_profile")
        .maybeSingle();

      if (error) throw error;
      if (!row) {
        return { profileId: null, profileName: null, createdAt: null, isValid: false };
      }

      const meta = (row.metadata || {}) as Record<string, unknown>;
      return {
        profileId:
          (meta.late_profile_id as string) ||
          (row.account_id as string) ||
          null,
        profileName: (row.account_name as string) || null,
        createdAt: (meta.late_profile_created_at as string) || null,
        isValid: Boolean(row.is_valid),
      };
    },
  });

  const createBrand = useMutation({
    mutationFn: async (opts?: { name?: string; timezone?: string; force?: boolean }) => {
      if (!clientId) throw new Error("clientId obrigatório");
      const { data: res, error } = await apiInvoke<{
        ok: boolean;
        profileId: string;
        name: string;
        already_existed: boolean;
      }>("late-create-brand", {
        body: { clientId, ...opts },
      });
      if (error) throw new Error(error.message);
      return res!;
    },
    onSuccess: (res) => {
      toast({
        title: res.already_existed ? "Profile já existe" : "Profile criado!",
        description: res.already_existed
          ? `Late profile ${res.name} já estava cadastrado (id ${res.profileId.substring(0, 8)}...).`
          : `Brand "${res.name}" criado no Late/Zernio. Agora conecte as redes abaixo.`,
      });
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["social-credentials", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-platform-status", clientId] });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao criar profile",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return {
    profileId: data?.profileId ?? null,
    profileName: data?.profileName ?? null,
    createdAt: data?.createdAt ?? null,
    isValid: data?.isValid ?? false,
    hasProfile: !!data?.profileId,
    isLoading,
    refetch,
    createBrand,
    isCreating: createBrand.isPending,
  };
}
