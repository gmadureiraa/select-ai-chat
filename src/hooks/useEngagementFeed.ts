import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EngagementOpportunity {
  id: string;
  client_id: string;
  tweet_id: string;
  author_username: string;
  author_name: string | null;
  author_avatar: string | null;
  author_followers: number | null;
  tweet_text: string;
  tweet_metrics: Record<string, number>;
  tweet_created_at: string | null;
  category: 'networking' | 'community' | 'growth';
  relevance_score: number;
  status: 'new' | 'saved' | 'replied' | 'dismissed';
  reply_text: string | null;
  reply_tweet_id: string | null;
  replied_at: string | null;
  created_at: string;
}

export function useEngagementFeed(clientId: string | null) {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { data: opportunities, isLoading, refetch } = useQuery({
    queryKey: ['engagement-feed', clientId, categoryFilter, statusFilter],
    queryFn: async () => {
      if (!clientId) return [];
      
      let query = supabase
        .from('engagement_opportunities')
        .select('*')
        .eq('client_id', clientId)
        .order('relevance_score', { ascending: false })
        .limit(50);

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (statusFilter === 'active') {
        query = query.in('status', ['new', 'saved']);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EngagementOpportunity[];
    },
    enabled: !!clientId,
  });

  const refreshFeed = useMutation({
    mutationFn: async ({ query }: { query?: string } = {}) => {
      if (!clientId) throw new Error('No client selected');
      
      const { data, error } = await supabase.functions.invoke('twitter-feed', {
        body: { clientId, query, maxResults: 30 },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.count} oportunidades encontradas`);
      queryClient.invalidateQueries({ queryKey: ['engagement-feed', clientId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao buscar feed: ${error.message}`);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('engagement_opportunities')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement-feed', clientId] });
    },
  });

  const generateReply = useMutation({
    mutationFn: async ({ opportunityId, tone }: { opportunityId: string; tone: string }) => {
      if (!clientId) throw new Error('No client selected');
      
      const { data, error } = await supabase.functions.invoke('twitter-reply', {
        body: { clientId, opportunityId, tone, generateOnly: true },
      });

      if (error) throw error;
      return data;
    },
  });

  const postReply = useMutation({
    mutationFn: async ({ opportunityId, replyText }: { opportunityId: string; replyText: string }) => {
      if (!clientId) throw new Error('No client selected');
      
      const { data, error } = await supabase.functions.invoke('twitter-reply', {
        body: { clientId, opportunityId, replyText },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Reply publicada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['engagement-feed', clientId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao publicar reply: ${error.message}`);
    },
  });

  return {
    opportunities: opportunities || [],
    isLoading,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    refreshFeed,
    updateStatus,
    generateReply,
    postReply,
    refetch,
  };
}
