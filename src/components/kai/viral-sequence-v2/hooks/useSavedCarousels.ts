/**
 * useSavedCarousels — lista carrosséis salvos do cliente, com TanStack Query.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSavedCarousels,
  deleteCarousel,
  type SavedCarouselSummary,
} from "../lib/storage";

export function useSavedCarousels(clientId: string | undefined) {
  return useQuery<SavedCarouselSummary[]>({
    queryKey: ["viral-carousels-v2", clientId],
    queryFn: () => (clientId ? listSavedCarousels(clientId) : Promise.resolve([])),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

export function useDeleteCarousel(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCarousel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["viral-carousels-v2", clientId] });
    },
  });
}
