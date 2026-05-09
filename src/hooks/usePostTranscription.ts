// usePostTranscription — hook pra puxar/gerar transcrição de um post.
//
// usePostTranscription(clientId, postId, source) — read-only (puxa do cache)
// useTranscribePostMutation()                   — gera nova (ou força re-transcrição)
//
// Backend: /api/transcribe-post-get + /api/transcribe-post
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiInvoke } from "@/lib/apiInvoke";

export interface CarouselSlide {
  index: number;
  image_url: string;
  description: string;
}

export interface ReelScene {
  start_sec: number;
  end_sec: number;
  description: string;
}

export interface PostTranscription {
  id: string;
  client_id: string;
  post_id: string;
  source: "metricool" | "instagram_posts" | "planning" | string;
  network: string;
  post_type: string | null;
  caption: string | null;
  visual_description: string | null;
  carousel_slides: CarouselSlide[] | null;
  reel_audio_transcript: string | null;
  reel_scenes: ReelScene[] | null;
  story_description: string | null;
  full_summary: string | null;
  language: string;
  model: string;
  tokens_used: number;
  created_at: string;
  updated_at: string;
}

export type TranscriptionSource = "metricool" | "instagram_posts" | "planning";

const QUERY_KEY = "post-transcription" as const;

export function usePostTranscription(
  clientId: string | null | undefined,
  postId: string | null | undefined,
  source: TranscriptionSource = "instagram_posts",
  enabled = true,
) {
  return useQuery({
    queryKey: [QUERY_KEY, clientId, postId, source],
    enabled: !!clientId && !!postId && enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PostTranscription | null> => {
      const { data, error } = await apiInvoke("transcribe-post-get", {
        body: { clientId, postId, source },
      });
      if (error) throw new Error(error.message || "Falha ao buscar transcrição");
      const list = (data as any)?.transcriptions as PostTranscription[] | undefined;
      return list && list.length > 0 ? list[0] : null;
    },
  });
}

export interface TranscribePostInput {
  clientId: string;
  postId: string;
  source?: TranscriptionSource;
  network?: string;
  postType?: string;
  imageUrls?: string[];
  videoUrl?: string;
  caption?: string;
  force?: boolean;
}

export function useTranscribePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TranscribePostInput): Promise<PostTranscription> => {
      const { data, error } = await apiInvoke("transcribe-post", {
        body: input,
      });
      if (error) throw new Error(error.message || "Falha ao gerar transcrição");
      const t = (data as any)?.transcription as PostTranscription | undefined;
      if (!t) throw new Error("Resposta sem transcrição");
      return t;
    },
    onSuccess: (t) => {
      qc.setQueryData([QUERY_KEY, t.client_id, t.post_id, t.source], t);
      qc.invalidateQueries({ queryKey: [QUERY_KEY, t.client_id, t.post_id] });
    },
  });
}
