// Inbox unificado Metricool — DMs + comentários + reviews.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

export function useMetricoolInbox(clientId: string, mode: 'list-conversations' | 'list-comments' | 'list-reviews' = 'list-conversations') {
  return useQuery({
    queryKey: ['metricool-inbox', clientId, mode],
    queryFn: async () => {
      const { data, error } = await apiInvoke('metricool-inbox', { body: { clientId, mode } });
      if (error) throw error;
      return data as { ok: boolean; conversations?: any[]; comments?: any[]; reviews?: any[] };
    },
    enabled: !!clientId,
    staleTime: 1000 * 30, // 30s — inbox quer dados frescos
  });
}

export function useMetricoolInboxActions(clientId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['metricool-inbox', clientId] });

  const sendMessage = useMutation({
    mutationFn: async (vars: { conversationId: string; text: string; mediaUrl?: string }) => {
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode: 'send-message', ...vars },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const replyComment = useMutation({
    mutationFn: async (vars: { commentId: string; text: string; network: string }) => {
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode: 'reply-comment', ...vars },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const replyReview = useMutation({
    mutationFn: async (vars: { reviewId: string; text: string; network: string }) => {
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode: 'reply-review', ...vars },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: 'OPEN' | 'CLOSED' | 'PENDING'; type: 'conversation' | 'comment' }) => {
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode: 'set-status', ...vars },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  return { sendMessage, replyComment, replyReview, setStatus };
}
