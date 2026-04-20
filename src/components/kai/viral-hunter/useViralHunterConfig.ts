/**
 * Hook pra ler/gravar a config do Viral Hunter (keywords, concorrentes, canais)
 * persistida em client.tags.viral_hunter (JSON string).
 *
 * MVP simplificado — se escalar, migrar pra tabela dedicada
 * client_viral_sources com colunas relacionais.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseViralHunterConfig, type ViralHunterConfig } from "./types";

const TAG_KEY = "viral_hunter";

async function fetchClientTags(clientId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("clients")
    .select("tags")
    .eq("id", clientId)
    .single();
  if (error) throw error;
  return (data?.tags as Record<string, string>) ?? {};
}

export function useViralHunterConfig(clientId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<ViralHunterConfig>({
    queryKey: ["viral-hunter-config", clientId],
    queryFn: async () => {
      const tags = await fetchClientTags(clientId);
      return parseViralHunterConfig(tags[TAG_KEY]);
    },
    enabled: !!clientId,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (next: ViralHunterConfig) => {
      const tags = await fetchClientTags(clientId);
      const updated = { ...tags, [TAG_KEY]: JSON.stringify(next) };
      const { error } = await supabase
        .from("clients")
        .update({ tags: updated })
        .eq("id", clientId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["viral-hunter-config", clientId], next);
    },
  });

  return {
    config: query.data ?? { keywords: [], competitors: [] },
    isLoading: query.isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
