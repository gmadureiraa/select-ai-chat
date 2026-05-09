// Inbox unificado Metricool — DMs + comentários + reviews.
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

/**
 * Hook auxiliar — observa visibilityState do documento e devolve
 * `true` quando a aba está em primeiro plano. Usado pra parar de
 * polling em background (poupa requests).
 */
function usePageVisible() {
  const [visible, setVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

export function useMetricoolInbox(
  clientId: string,
  mode: 'list-conversations' | 'list-comments' | 'list-reviews' = 'list-conversations',
  provider: string = 'instagram',
) {
  const visible = usePageVisible();
  return useQuery({
    queryKey: ['metricool-inbox', clientId, mode, provider],
    queryFn: async () => {
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode, provider },
      });
      if (error) throw error;
      return data as {
        ok: boolean;
        provider?: string;
        conversations?: any[];
        comments?: any[];
        reviews?: any[];
      };
    },
    enabled: !!clientId,
    staleTime: 1000 * 30,
    // Polling a cada 30s só quando aba visível (false desliga interval)
    refetchInterval: visible ? 1000 * 30 : false,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook leve só pra contagem de não-lidas — usado pelo badge da sidebar.
 * Polling a cada 60s. Soma `unreadCount` das conversas (DM) do provider
 * default (Instagram) — é o canal mais ativo. Se quiser somar todos
 * providers, precisaria de loop, mas Metricool não tem endpoint agregado
 * então mantemos o foco em IG pra performance.
 */
export function useInboxUnreadCount(clientId: string | null | undefined) {
  const visible = usePageVisible();
  return useQuery({
    queryKey: ['metricool-inbox-unread-count', clientId],
    queryFn: async () => {
      if (!clientId) return 0;
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode: 'list-conversations', provider: 'instagram' },
      });
      if (error) throw error;
      const conversations = (data as any)?.conversations || [];
      const total = conversations.reduce(
        (acc: number, c: any) => acc + (Number(c?.unreadCount) || 0),
        0,
      );
      return total;
    },
    enabled: !!clientId,
    staleTime: 1000 * 30,
    refetchInterval: visible ? 1000 * 60 : false,
    refetchOnWindowFocus: true,
  });
}

export function useMetricoolInboxActions(clientId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['metricool-inbox', clientId] });
    qc.invalidateQueries({ queryKey: ['metricool-inbox-unread-count', clientId] });
  };

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
    mutationFn: async (vars: {
      id: string;
      status: 'OPEN' | 'CLOSED' | 'PENDING';
      type: 'conversation' | 'comment';
    }) => {
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
