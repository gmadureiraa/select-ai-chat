import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstagramStory {
  id: string;
  client_id: string;
  story_id: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  views: number | null;
  reach: number | null;
  interactions: number | null;
  likes: number | null;
  replies: number | null;
  shares: number | null;
  retention_rate: number | null;
  forward_taps: number | null;
  next_story_taps: number | null;
  back_taps: number | null;
  exit_taps: number | null;
  posted_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useInstagramStories(clientId: string, limit: number = 100) {
  return useQuery({
    queryKey: ["instagram-stories", clientId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_stories")
        .select("*")
        .eq("client_id", clientId)
        .order("posted_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as InstagramStory[];
    },
    enabled: !!clientId,
  });
}