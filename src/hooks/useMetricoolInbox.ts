// Inbox unificado Metricool — DMs + comentários + reviews.
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '../lib/apiInvoke';

/**
 * Conta não-lidas de um item do inbox Metricool, derivando de `status === 'PENDING'`.
 * Mantém compat com qualquer `unreadCount` numérico que a API venha a expor no futuro.
 * Mesmo algoritmo usado no MetricoolInboxPanel — extraído pra ser reusável pelo
 * badge da sidebar (e qualquer outro consumidor que precise de contagem).
 */
export function getInboxItemUnreadCount(item: any): number {
  if (typeof item?.unreadCount === 'number') return item.unreadCount;
  const status = (item?.status ?? '').toString().toUpperCase();
  if (status !== 'PENDING') return 0;
  const msgs: any[] = Array.isArray(item?.messages) ? item.messages : [];
  if (msgs.length > 0) {
    const self = item?.self ? String(item.self) : null;
    const pending = msgs.filter((m) => {
      const msgStatus = (m?.status ?? '').toString().toUpperCase();
      const fromOther = self ? String(m?.from) !== self : true;
      return fromOther && (msgStatus === 'NEW' || msgStatus === 'PENDING');
    });
    return pending.length || 1;
  }
  return 1;
}

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
 * Polling a cada 60s. Soma `getInboxItemUnreadCount` das conversas (DM) do
 * provider default (Instagram) — é o canal mais ativo. Se quiser somar
 * todos providers, precisaria de loop, mas Metricool não tem endpoint
 * agregado então mantemos o foco em IG pra performance.
 *
 * IMPORTANT: Usa a MESMA derivação do painel (`PENDING` status) pq a API
 * Metricool NÃO retorna campo `unreadCount` numérico — ler `c.unreadCount`
 * direto sempre dava 0 (bug pré-2026-05-09).
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
        (acc: number, c: any) => acc + getInboxItemUnreadCount(c),
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

  /**
   * Optimistic update — mutate cached conversation list pra empurrar a
   * bubble localmente assim que o user envia. onError reverte. onSuccess
   * invalida (a refetch traz o estado autoritativo do servidor).
   *
   * Snapshot pattern recomendado pelo TanStack: capturar previousData no
   * onMutate, retornar como `context`, e restaurar em onError.
   */
  const sendMessage = useMutation({
    mutationFn: async (vars: { conversationId: string; text: string; mediaUrl?: string }) => {
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode: 'send-message', ...vars },
      });
      if (error) throw error;
      return data;
    },
    onMutate: async (vars) => {
      // Cancela refetches em voo pra não atropelar o optimistic.
      await qc.cancelQueries({ queryKey: ['metricool-inbox', clientId] });

      const tempId = `__optimistic-${Date.now()}`;
      const now = new Date().toISOString();

      // Snapshot de TODAS as queries com prefix [metricool-inbox, clientId]
      // (cobre os 3 modes × N providers). Pequeno custo, alta resiliência.
      const snapshots: Array<[unknown[], any]> = [];

      qc.getQueriesData<any>({ queryKey: ['metricool-inbox', clientId] }).forEach(
        ([key, prev]) => {
          if (!prev) return;
          snapshots.push([key as unknown[], prev]);
          const conversations = Array.isArray(prev.conversations)
            ? prev.conversations.map((c: any) => {
                if (String(c?.id) !== String(vars.conversationId)) return c;
                const selfId = c?.self ? String(c.self) : 'self';
                const newMsg = {
                  id: tempId,
                  from: selfId,
                  to: null,
                  text: vars.text,
                  publicationDateTime: now,
                  attachments: [],
                  pending: true,
                };
                // Metricool entrega messages[0] = mais recente. Prepend.
                const prevMsgs = Array.isArray(c.messages) ? c.messages : [];
                return {
                  ...c,
                  messages: [newMsg, ...prevMsgs],
                  lastUpdateTime: now,
                };
              })
            : prev.conversations;
          qc.setQueryData(key as unknown[], { ...prev, conversations });
        },
      );

      return { snapshots, tempId };
    },
    onError: (_err, _vars, ctx) => {
      // Restaura tudo que mexemos.
      ctx?.snapshots?.forEach(([key, prev]) => qc.setQueryData(key, prev));
    },
    onSettled: invalidate,
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

  /**
   * `silent` — quando true, NÃO invalida no onSuccess. Usado em bulk
   * actions pra disparar UMA invalidação só no fim do batch (em vez de N
   * — uma por item — que causava avalanche de refetch).
   */
  const setStatus = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: 'OPEN' | 'CLOSED' | 'PENDING';
      type: 'conversation' | 'comment';
      silent?: boolean;
    }) => {
      const { silent: _silent, ...rest } = vars;
      const { data, error } = await apiInvoke('metricool-inbox', {
        body: { clientId, mode: 'set-status', ...rest },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      if (!vars.silent) invalidate();
    },
  });

  return { sendMessage, replyComment, replyReview, setStatus, invalidate };
}
