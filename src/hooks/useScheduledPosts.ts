import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export interface ScheduledPost {
  id: string;
  workspace_id: string;
  client_id: string;
  title: string;
  content: string;
  content_type: string;
  platform: 'twitter' | 'linkedin';
  scheduled_at: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  error_message: string | null;
  media_urls: string[];
  metadata: Record<string, unknown>;
  created_by: string;
  published_at: string | null;
  external_post_id: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    avatar_url: string | null;
  };
}

export interface CreateScheduledPostInput {
  client_id: string;
  title: string;
  content: string;
  content_type?: string;
  platform: 'twitter' | 'linkedin';
  scheduled_at: string;
  status?: 'draft' | 'scheduled';
  media_urls?: string[];
  metadata?: Record<string, unknown>;
}

export function useScheduledPosts(clientId?: string) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['scheduled-posts', currentWorkspace?.id, clientId],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('scheduled_posts')
        .select(`
          *,
          clients (
            name,
            avatar_url
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('scheduled_at', { ascending: true });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ScheduledPost[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const createPost = useMutation({
    mutationFn: async (input: CreateScheduledPostInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      if (!currentWorkspace?.id) throw new Error('Workspace não encontrado');

      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          ...input,
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          status: input.status || 'draft',
          media_urls: input.media_urls || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      toast.success('Post agendado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao agendar post: ${error.message}`);
    },
  });

  const updatePost = useMutation({
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
      toast.success('Post atualizado!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar post: ${error.message}`);
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      toast.success('Post excluído!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir post: ${error.message}`);
    },
  });

  const retryPost = useMutation({
    mutationFn: async (id: string) => {
      // First, reset the post status to scheduled
      const { data: post, error: updateError } = await supabase
        .from('scheduled_posts')
        .update({ 
          status: 'scheduled',
          error_message: null,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Then trigger the posting function
      const functionName = post.platform === 'twitter' ? 'twitter-post' : 'linkedin-post';
      const { error: fnError } = await supabase.functions.invoke(functionName, {
        body: { scheduledPostId: id },
      });

      if (fnError) throw fnError;
      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      toast.success('Post sendo republicado...');
    },
    onError: (error) => {
      toast.error(`Erro ao republicar: ${error.message}`);
    },
  });

  // Get posts by date for calendar view
  const getPostsByDate = (date: Date) => {
    if (!posts) return [];
    return posts.filter(post => {
      const postDate = new Date(post.scheduled_at);
      return postDate.toDateString() === date.toDateString();
    });
  };

  // Get posts by status
  const getPostsByStatus = (status: ScheduledPost['status']) => {
    if (!posts) return [];
    return posts.filter(post => post.status === status);
  };

  return {
    posts: posts || [],
    isLoading,
    error,
    createPost,
    updatePost,
    deletePost,
    retryPost,
    getPostsByDate,
    getPostsByStatus,
  };
}
