import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InstagramPost {
  id: string;
  client_id: string;
  post_id: string | null;
  post_type: string | null;
  caption: string | null;
  posted_at: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  impressions: number | null;
  engagement_rate: number | null;
  thumbnail_url: string | null;
  permalink: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  // Extended fields
  link_clicks: number | null;
  profile_visits: number | null;
  website_taps: number | null;
  content_objective: string | null;
  is_collab: boolean | null;
  // Content fields
  full_content: string | null;
  images: string[] | null;
  content_synced_at: string | null;
}

export function useInstagramPosts(clientId: string, limit: number = 100) {
  return useQuery({
    queryKey: ["instagram-posts", clientId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_posts")
        .select("*")
        .eq("client_id", clientId)
        .order("posted_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as InstagramPost[];
    },
    enabled: !!clientId,
  });
}

export function useImportInstagramPostsCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      posts,
    }: {
      clientId: string;
      posts: Array<{
        post_id: string;
        post_type?: string;
        caption?: string;
        posted_at?: string;
        likes?: number;
        comments?: number;
        shares?: number;
        saves?: number;
        reach?: number;
        impressions?: number;
        engagement_rate?: number;
        thumbnail_url?: string;
        permalink?: string;
      }>;
    }) => {
      const postsToInsert = posts.map((post) => ({
        client_id: clientId,
        post_id: post.post_id,
        post_type: post.post_type || "image",
        caption: post.caption || null,
        posted_at: post.posted_at || null,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        saves: post.saves || 0,
        reach: post.reach || 0,
        impressions: post.impressions || 0,
        engagement_rate: post.engagement_rate || 0,
        thumbnail_url: post.thumbnail_url || null,
        permalink: post.permalink || null,
      }));

      const { error } = await supabase
        .from("instagram_posts")
        .upsert(postsToInsert, { onConflict: "client_id,post_id" });

      if (error) throw error;

      return { postsImported: postsToInsert.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-posts"] });
      toast.success(`${data.postsImported} posts importados com sucesso`);
    },
    onError: (error) => {
      console.error("Error importing Instagram posts:", error);
      toast.error("Erro ao importar posts do Instagram");
    },
  });
}

export function useInstagramPostsStats(clientId: string) {
  return useQuery({
    queryKey: ["instagram-posts-stats", clientId],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from("instagram_posts")
        .select("likes, comments, shares, saves, engagement_rate, posted_at")
        .eq("client_id", clientId);

      if (error) throw error;

      if (!posts || posts.length === 0) {
        return {
          totalPosts: 0,
          totalLikes: 0,
          totalComments: 0,
          avgEngagement: 0,
          bestPost: null,
        };
      }

      const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
      const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
      const avgEngagement =
        posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length;

      return {
        totalPosts: posts.length,
        totalLikes,
        totalComments,
        avgEngagement,
      };
    },
    enabled: !!clientId,
  });
}

export function useUpdateInstagramPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      updates,
    }: {
      postId: string;
      updates: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("instagram_posts")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-posts"] });
      toast.success("Post atualizado com sucesso");
    },
    onError: (error) => {
      console.error("Error updating Instagram post:", error);
      toast.error("Erro ao atualizar post");
    },
  });
}
