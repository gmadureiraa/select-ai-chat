/**
 * Hook pra ler/gravar a config do Viral Hunter (keywords, concorrentes)
 * persistida em tabelas dedicadas no Supabase:
 *   - client_viral_keywords
 *   - client_viral_competitors
 *
 * Mantém a mesma API pública (config / save) que existia quando os dados
 * viviam em clients.tags.viral_hunter — componentes não precisam mudar.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ViralHunterConfig, CompetitorEntry } from "./types";

async function fetchConfig(clientId: string): Promise<ViralHunterConfig> {
  const [{ data: kws, error: kErr }, { data: comps, error: cErr }] = await Promise.all([
    supabase
      .from("client_viral_keywords")
      .select("keyword")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_viral_competitors")
      .select("platform, handle, notes, added_at")
      .eq("client_id", clientId)
      .order("added_at", { ascending: true }),
  ]);
  if (kErr) throw kErr;
  if (cErr) throw cErr;

  return {
    keywords: (kws ?? []).map((r) => r.keyword as string),
    competitors: (comps ?? []).map(
      (r): CompetitorEntry => ({
        platform: r.platform as CompetitorEntry["platform"],
        handle: r.handle as string,
        notes: (r.notes ?? undefined) as string | undefined,
        addedAt: (r.added_at ?? new Date().toISOString()) as string,
      }),
    ),
  };
}

export function useViralHunterConfig(clientId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<ViralHunterConfig>({
    queryKey: ["viral-hunter-config", clientId],
    queryFn: () => fetchConfig(clientId),
    enabled: !!clientId,
    staleTime: 30_000,
  });

  // Diff-based save: insere o que é novo, deleta o que sumiu.
  const mutation = useMutation({
    mutationFn: async (next: ViralHunterConfig) => {
      const current = await fetchConfig(clientId);

      // ---- Keywords ----
      const currentKws = new Set(current.keywords.map((k) => k.toLowerCase()));
      const nextKws = new Set(next.keywords.map((k) => k.trim()).filter(Boolean));
      const nextKwsLower = new Set(Array.from(nextKws).map((k) => k.toLowerCase()));

      const kwToInsert = Array.from(nextKws).filter((k) => !currentKws.has(k.toLowerCase()));
      const kwToDelete = current.keywords.filter((k) => !nextKwsLower.has(k.toLowerCase()));

      if (kwToInsert.length > 0) {
        const { error } = await supabase
          .from("client_viral_keywords")
          .insert(kwToInsert.map((keyword) => ({ client_id: clientId, keyword })));
        if (error) throw error;
      }
      if (kwToDelete.length > 0) {
        const { error } = await supabase
          .from("client_viral_keywords")
          .delete()
          .eq("client_id", clientId)
          .in("keyword", kwToDelete);
        if (error) throw error;
      }

      // ---- Competitors ----
      const compKey = (c: Pick<CompetitorEntry, "platform" | "handle">) =>
        `${c.platform}::${c.handle.toLowerCase()}`;
      const currentMap = new Map(current.competitors.map((c) => [compKey(c), c]));
      const nextMap = new Map(next.competitors.map((c) => [compKey(c), c]));

      const compToInsert: CompetitorEntry[] = [];
      for (const [k, c] of nextMap) {
        if (!currentMap.has(k)) compToInsert.push(c);
      }
      const compToDelete: CompetitorEntry[] = [];
      for (const [k, c] of currentMap) {
        if (!nextMap.has(k)) compToDelete.push(c);
      }

      if (compToInsert.length > 0) {
        const { error } = await supabase.from("client_viral_competitors").insert(
          compToInsert.map((c) => ({
            client_id: clientId,
            platform: c.platform,
            handle: c.handle,
            notes: c.notes ?? null,
          })),
        );
        if (error) throw error;
      }
      for (const c of compToDelete) {
        const { error } = await supabase
          .from("client_viral_competitors")
          .delete()
          .eq("client_id", clientId)
          .eq("platform", c.platform)
          .eq("handle", c.handle);
        if (error) throw error;
      }

      return await fetchConfig(clientId);
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
