import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ScheduledPost {
  id: string;
  user_id: string;
  client_id: string | null;
  content: string;
  platforms: string[];
  image_url: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at: string | null;
  published_at: string | null;
  publish_results: any[];
  created_at: string;
  updated_at: string;
}

export function useScheduledPosts(status?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduled-posts', status],
    queryFn: async () => {
      let query = supabase
        .from('scheduled_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ScheduledPost[];
    },
    enabled: !!user,
  });
}

export function useCreateScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: {
      content: string;
      platforms: string[];
      client_id?: string;
      image_url?: string;
      status: 'draft' | 'scheduled';
      scheduled_at?: string;
    }) => {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert(post)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
    },
  });
}

export function useUpdateScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduledPost> & { id: string }) => {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
    },
  });
}

export function useDeleteScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
    },
  });
}
