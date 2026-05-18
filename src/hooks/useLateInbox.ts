// useLateInbox — hooks pro Late/Zernio Inbox unificado.
// Substitui o stub useMetricoolInbox.ts (Metricool removido 2026-05-18).
//
// Padrão tanstack-query: queries com staleTime baixo (30s) pra inbox parecer
// "ao vivo" sem martelar a Late API, mutations com optimistic invalidate.
//
// Endpoints chamados: /api/late-inbox (handler único multi-mode, ver
// api/_handlers/late-inbox.ts).

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types — shape exposto pra UI. NÃO espelha 1-pra-1 o shape da Late API
// porque é multi-platform (cada rede tem campos próprios). UI consome via
// helpers (getItem*) que tratam ausência defensivamente.
// ─────────────────────────────────────────────────────────────────────────────

export type LateInboxMode =
  | 'list-conversations'
  | 'list-comments'
  | 'list-reviews';

export interface LateInboxFilters {
  /** Plataforma específica (instagram, facebook, twitter, linkedin, tiktok, youtube, threads). */
  platform?: string;
  /** Filtro status — Late aceita 'active' | 'archived'. */
  status?: 'active' | 'archived' | 'open' | 'closed';
  /** Texto de busca (filtragem client-side, Late não tem search nativo). */
  search?: string;
  /** Mostrar só não-lidas (client-side). */
  unreadOnly?: boolean;
}

export interface LateConversation {
  id: string;
  platform?: string;
  accountId?: string;
  participants?: Array<{
    id?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
    imageProfileUrl?: string;
  }>;
  lastMessage?: {
    text?: string;
    sentAt?: string;
    fromSelf?: boolean;
  };
  unreadCount?: number;
  status?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Shape passthrough — Late pode adicionar campos não mapeados. */
  [key: string]: unknown;
}

export interface LateComment {
  id: string;
  platform?: string;
  accountId?: string;
  postId?: string;
  text?: string;
  author?: {
    id?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  createdAt?: string;
  isReplied?: boolean;
  hidden?: boolean;
  [key: string]: unknown;
}

export interface LateReview {
  id: string;
  platform?: string;
  rating?: number;
  text?: string;
  author?: { name?: string; avatarUrl?: string };
  createdAt?: string;
  replied?: boolean;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — extraem campos de shape variável (Late ainda evolui).
// ─────────────────────────────────────────────────────────────────────────────

function getConvUnread(c: LateConversation): number {
  const direct = Number(c.unreadCount ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  // Heurística: status PENDING/OPEN indica não-lido em alguns providers.
  const status = (c.status || '').toString().toUpperCase();
  if (status === 'PENDING' || status === 'UNREAD') return 1;
  return 0;
}

function getCommentUnread(c: LateComment): number {
  if (c.isReplied) return 0;
  return 1;
}

function getReviewUnread(r: LateReview): number {
  return r.replied ? 0 : 1;
}

/** Helper público pra contar não-lidas em qualquer item do inbox. */
export function getInboxItemUnreadCount(
  item: LateConversation | LateComment | LateReview,
): number {
  if ('participants' in item || 'lastMessage' in item) {
    return getConvUnread(item as LateConversation);
  }
  if ('rating' in item) {
    return getReviewUnread(item as LateReview);
  }
  return getCommentUnread(item as LateComment);
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

const STALE_MS = 30_000; // 30s — inbox parece "ao vivo" sem destruir a API.

export function lateInboxQueryKey(
  clientId: string | null | undefined,
  mode: LateInboxMode,
  filters?: LateInboxFilters,
) {
  return [
    'late-inbox',
    clientId ?? 'no-client',
    mode,
    filters?.platform ?? 'all',
    filters?.status ?? 'any',
  ] as const;
}

export function useLateConversations(
  clientId: string | null | undefined,
  filters: LateInboxFilters = {},
  options?: Partial<UseQueryOptions<{ conversations: LateConversation[] }>>,
) {
  return useQuery({
    queryKey: lateInboxQueryKey(clientId, 'list-conversations', filters),
    enabled: !!clientId,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await apiInvoke<{
        ok: boolean;
        conversations?: LateConversation[];
        error?: string;
      }>('late-inbox', {
        body: {
          clientId,
          mode: 'list-conversations',
          platform: filters.platform,
        },
      });
      if (error) throw new Error(error.message);
      return { conversations: data?.conversations ?? [] };
    },
    ...options,
  });
}

export function useLateComments(
  clientId: string | null | undefined,
  filters: LateInboxFilters & { postId?: string } = {},
  options?: Partial<UseQueryOptions<{ comments: LateComment[] }>>,
) {
  return useQuery({
    queryKey: [
      ...lateInboxQueryKey(clientId, 'list-comments', filters),
      filters.postId ?? 'all-posts',
    ],
    enabled: !!clientId && !!filters.platform,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await apiInvoke<{
        ok: boolean;
        comments?: LateComment[];
        error?: string;
      }>('late-inbox', {
        body: {
          clientId,
          mode: 'list-comments',
          platform: filters.platform,
          postId: filters.postId,
        },
      });
      if (error) throw new Error(error.message);
      return { comments: data?.comments ?? [] };
    },
    ...options,
  });
}

export function useLateReviews(
  clientId: string | null | undefined,
  filters: LateInboxFilters = {},
  options?: Partial<UseQueryOptions<{ reviews: LateReview[] }>>,
) {
  return useQuery({
    queryKey: lateInboxQueryKey(clientId, 'list-reviews', filters),
    enabled: !!clientId,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await apiInvoke<{
        ok: boolean;
        reviews?: LateReview[];
        error?: string;
      }>('late-inbox', {
        body: {
          clientId,
          mode: 'list-reviews',
          platform: filters.platform,
          status: filters.status,
        },
      });
      if (error) throw new Error(error.message);
      return { reviews: data?.reviews ?? [] };
    },
    ...options,
  });
}

/** Mensagens dentro de uma conversa específica (thread view). */
export function useLateConversationMessages(
  clientId: string | null | undefined,
  conversationId: string | null | undefined,
  platform: string | undefined,
) {
  return useQuery({
    queryKey: ['late-inbox-messages', clientId, conversationId, platform],
    enabled: !!clientId && !!conversationId && !!platform,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await apiInvoke<{
        ok: boolean;
        messages?: any[];
        error?: string;
      }>('late-inbox', {
        body: {
          clientId,
          mode: 'list-messages',
          conversationId,
          platform,
        },
      });
      if (error) throw new Error(error.message);
      return { messages: data?.messages ?? [] };
    },
  });
}

/**
 * Count global de não-lidas pro cliente (DMs + comments + reviews somados).
 * Usado pelo badge na sidebar e bell. Mantém o nome `useInboxUnreadCount`
 * pra compat com o stub antigo de Metricool — outros componentes não
 * precisam de alteração de import além de trocar a fonte.
 *
 * Estratégia: roda uma única query no mode list-conversations (DMs é o
 * indicador mais sensível e mais usado pra triagem). Conta unreadCount
 * ou status === 'PENDING' por conversation.
 *
 * Se quiser counts separados, use `useLateConversations` e some no caller.
 */
export function useInboxUnreadCount(clientId?: string | null) {
  const q = useQuery({
    queryKey: ['late-inbox-unread', clientId ?? 'no-client'],
    enabled: !!clientId,
    // Refetch a cada 60s pra refletir mudanças sem precisar do user fazer nada.
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await apiInvoke<{
        ok: boolean;
        conversations?: LateConversation[];
        error?: string;
      }>('late-inbox', {
        body: {
          clientId,
          mode: 'list-conversations',
        },
      });
      if (error) throw new Error(error.message);
      const conversations = data?.conversations ?? [];
      return conversations.reduce((acc, c) => acc + getConvUnread(c), 0);
    },
  });
  return { data: q.data ?? 0, isLoading: q.isLoading, error: q.error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export function useReplyMessage(clientId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      text,
      platform,
    }: {
      conversationId: string;
      text: string;
      platform?: string;
    }) => {
      const { data, error } = await apiInvoke('late-inbox', {
        body: {
          clientId,
          mode: 'send-message',
          conversationId,
          text,
          platform,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      // Invalida tanto a lista quanto a thread aberta.
      qc.invalidateQueries({ queryKey: ['late-inbox', clientId] });
      qc.invalidateQueries({ queryKey: ['late-inbox-messages', clientId] });
      qc.invalidateQueries({ queryKey: ['late-inbox-unread', clientId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao enviar mensagem');
    },
  });
}

export function useReplyComment(clientId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      text,
      platform,
    }: {
      commentId: string;
      text: string;
      platform: string;
    }) => {
      const { data, error } = await apiInvoke('late-inbox', {
        body: {
          clientId,
          mode: 'reply-comment',
          commentId,
          text,
          platform,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['late-inbox', clientId] });
      qc.invalidateQueries({ queryKey: ['late-inbox-unread', clientId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao responder comentário');
    },
  });
}

export function useReplyReview(clientId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      text,
      platform,
    }: {
      reviewId: string;
      text: string;
      platform: string;
    }) => {
      const { data, error } = await apiInvoke('late-inbox', {
        body: {
          clientId,
          mode: 'reply-review',
          reviewId,
          text,
          platform,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['late-inbox', clientId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao responder review');
    },
  });
}

/**
 * Marca conversa como lida/arquivada. Late expõe `archived: bool` no PATCH
 * — pra "marcar lido" usamos archived=false + envia patch (touch). Pra
 * arquivar, archived=true.
 */
export function useMarkAsRead(clientId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      platform,
      status,
    }: {
      conversationId: string;
      platform: string;
      status: 'archived' | 'active';
    }) => {
      const { data, error } = await apiInvoke('late-inbox', {
        body: {
          clientId,
          mode: 'mark-conversation',
          conversationId,
          status,
          platform,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['late-inbox', clientId] });
      qc.invalidateQueries({ queryKey: ['late-inbox-unread', clientId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar conversa');
    },
  });
}

export function useHideComment(clientId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      platform,
    }: {
      commentId: string;
      platform: string;
    }) => {
      const { data, error } = await apiInvoke('late-inbox', {
        body: {
          clientId,
          mode: 'hide-comment',
          commentId,
          platform,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['late-inbox', clientId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao ocultar comentário');
    },
  });
}
