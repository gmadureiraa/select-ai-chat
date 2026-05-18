// Late/Zernio Inbox unificado — DMs + comentários + reviews.
// Substitui o antigo metricool-inbox (arquivado em
// _TRASH-2026-05-18-metricool-removed/handlers/).
//
// API: https://docs.zernio.com/api-reference/inbox (Late renomeado pra Zernio).
//
// Modes suportados:
//   list-conversations  → GET /v1/messages/conversations (por profileId, platform opcional)
//   list-messages       → GET /v1/messages/conversations/{conversationId}
//   list-comments       → GET /v1/inbox/comments/{postId} OU /v1/inbox/post-comments
//   list-reviews        → GET /v1/reviews (platform + status opcionais)
//   send-message        → POST /v1/messages/send (DM reply)
//   reply-comment       → POST /v1/inbox/comments/reply
//   reply-review        → POST /v1/reviews/{reviewId}/reply
//   mark-conversation   → PATCH /v1/messages/conversations/{conversationId} (archive/active)
//   hide-comment        → PATCH /v1/inbox/comments/{commentId}/hide
//
// Multi-account: cliente pode ter várias accounts conectadas (instagram +
// linkedin + twitter etc). Resolvemos accountId via:
//   1) accountId explícito no body (sobrescreve qualquer lookup)
//   2) lookup por platform em client_social_credentials.metadata.late_account_id
//
// profileId pra list-conversations agnóstico: derivamos de
// client_social_credentials.metadata.late_profile_id (qualquer linha do cliente
// serve, são todos do mesmo profile Late).
//
// Graceful degradation: se Late API retornar 4xx/5xx, devolvemos
// `{ ok: false, error: '...', items: [] }` em vez de throw — frontend já tem
// fallback pra dados mock.

import { authedPost } from '../_lib/handler.js';
import { query, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const LATE_API_BASE = 'https://getlate.dev/api/v1';

type Mode =
  | 'list-conversations'
  | 'list-messages'
  | 'list-comments'
  | 'list-reviews'
  | 'send-message'
  | 'reply-comment'
  | 'reply-review'
  | 'mark-conversation'
  | 'hide-comment';

interface LateCredentialRow {
  platform: string;
  metadata: Record<string, unknown> | null;
  is_valid: boolean | null;
}

/** Resolve o late_profile_id e accounts conectadas pro cliente. */
async function loadLateCredentials(clientId: string) {
  const rows = await query<LateCredentialRow>(
    `SELECT platform, metadata, is_valid
       FROM client_social_credentials
      WHERE client_id = $1`,
    [clientId],
  );

  const credentials = (rows || []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      platform: row.platform,
      isValid: row.is_valid ?? false,
      lateProfileId: (meta.late_profile_id as string) || undefined,
      lateAccountId: (meta.late_account_id as string) || undefined,
    };
  });

  const profileId = credentials.find((c) => c.lateProfileId)?.lateProfileId;
  const byPlatform = new Map<string, { lateAccountId?: string; isValid: boolean }>();
  for (const cred of credentials) {
    if (!cred.lateAccountId) continue;
    byPlatform.set(cred.platform, {
      lateAccountId: cred.lateAccountId,
      isValid: cred.isValid,
    });
  }

  return { profileId, byPlatform, credentials };
}

function resolveAccountId(
  byPlatform: Map<string, { lateAccountId?: string; isValid: boolean }>,
  platform: string | undefined,
  explicit: string | undefined,
): string | undefined {
  if (explicit) return explicit;
  if (!platform) return undefined;
  return byPlatform.get(platform)?.lateAccountId;
}

type LateResponseData = Record<string, unknown> | null;

async function lateRequest(
  path: string,
  apiKey: string,
  init: RequestInit & { searchParams?: Record<string, string | number | undefined> } = {},
): Promise<{ ok: boolean; status: number; data: LateResponseData; error?: string }> {
  const { searchParams, ...rest } = init;
  const url = new URL(`${LATE_API_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) || {}),
  };
  try {
    const r = await fetch(url.toString(), { ...rest, headers });
    const text = await r.text();
    let data: LateResponseData = null;
    try {
      data = text ? (JSON.parse(text) as LateResponseData) : null;
    } catch {
      data = { raw: text };
    }
    if (!r.ok) {
      const error =
        (data?.error as string) ||
        (data?.message as string) ||
        `Late API ${r.status}`;
      return { ok: false, status: r.status, data, error };
    }
    return { ok: true, status: r.status, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error talking to Late API';
    return { ok: false, status: 0, data: null, error: message };
  }
}

export default authedPost(async ({ body, user }) => {
  const lateApiKey = process.env.LATE_API_KEY;
  if (!lateApiKey) throw new Error('LATE_API_KEY não configurada');

  const {
    clientId,
    mode = 'list-conversations',
    platform,
    accountId: explicitAccountId,
    conversationId,
    postId,
    commentId,
    reviewId,
    messageId,
    text,
    status,
    limit,
    cursor,
  } = body as {
    clientId?: string;
    mode?: Mode;
    platform?: string;
    accountId?: string;
    conversationId?: string;
    postId?: string;
    commentId?: string;
    reviewId?: string;
    messageId?: string;
    text?: string;
    status?: 'active' | 'archived' | 'open' | 'closed';
    limit?: number;
    cursor?: string;
  };

  if (!clientId) throw new Error('clientId é obrigatório');
  await assertClientAccess(user.id, clientId);

  const { profileId, byPlatform } = await loadLateCredentials(clientId);
  const accountId = resolveAccountId(byPlatform, platform, explicitAccountId);

  switch (mode) {
    case 'list-conversations': {
      if (!profileId) {
        return {
          ok: true,
          conversations: [],
          message: 'Cliente sem perfil Late conectado',
        };
      }
      const r = await lateRequest('/messages/conversations', lateApiKey, {
        method: 'GET',
        searchParams: { profileId, platform, limit, cursor },
      });
      if (!r.ok) {
        return {
          ok: false,
          conversations: [],
          error: r.error,
          status: r.status,
        };
      }
      const conversations =
        (r.data?.conversations as unknown[]) ||
        (r.data?.data as unknown[]) ||
        (r.data?.items as unknown[]) ||
        [];
      return { ok: true, conversations, nextCursor: r.data?.nextCursor };
    }

    case 'list-messages': {
      if (!conversationId) throw new Error('conversationId obrigatório');
      if (!accountId) {
        return { ok: false, messages: [], error: 'Conta Late não encontrada pra essa plataforma' };
      }
      const r = await lateRequest(
        `/messages/conversations/${encodeURIComponent(conversationId)}`,
        lateApiKey,
        {
          method: 'GET',
          searchParams: { accountId, sortOrder: 'asc', limit: limit ?? 50, cursor },
        },
      );
      if (!r.ok) {
        return { ok: false, messages: [], error: r.error, status: r.status };
      }
      const messages =
        (r.data?.messages as unknown[]) ||
        (r.data?.data as unknown[]) ||
        (r.data?.items as unknown[]) ||
        [];
      return { ok: true, messages, nextCursor: r.data?.nextCursor };
    }

    case 'list-comments': {
      if (!accountId) {
        return { ok: false, comments: [], error: 'Conta Late não encontrada pra essa plataforma' };
      }
      // Sem postId: usa /post-comments (todos os posts da conta).
      // Com postId: /comments/{postId}.
      const path = postId
        ? `/inbox/comments/${encodeURIComponent(postId)}`
        : `/inbox/post-comments`;
      const r = await lateRequest(path, lateApiKey, {
        method: 'GET',
        searchParams: { accountId, postId, limit, cursor },
      });
      if (!r.ok) {
        return { ok: false, comments: [], error: r.error, status: r.status };
      }
      const comments =
        (r.data?.comments as unknown[]) ||
        (r.data?.data as unknown[]) ||
        (r.data?.items as unknown[]) ||
        [];
      return { ok: true, comments, nextCursor: r.data?.nextCursor };
    }

    case 'list-reviews': {
      const r = await lateRequest('/reviews', lateApiKey, {
        method: 'GET',
        searchParams: { platform, status, limit, cursor },
      });
      if (!r.ok) {
        return { ok: false, reviews: [], error: r.error, status: r.status };
      }
      const reviews =
        (r.data?.reviews as unknown[]) ||
        (r.data?.data as unknown[]) ||
        (r.data?.items as unknown[]) ||
        [];
      return { ok: true, reviews, nextCursor: r.data?.nextCursor };
    }

    case 'send-message': {
      if (!conversationId) throw new Error('conversationId obrigatório');
      if (!text) throw new Error('text obrigatório');
      if (!accountId) throw new Error('Conta Late não conectada pra essa plataforma');
      const r = await lateRequest('/messages/send', lateApiKey, {
        method: 'POST',
        body: JSON.stringify({
          accountId,
          conversationId,
          text,
        }),
      });
      if (!r.ok) throw new Error(r.error || 'Falha ao enviar mensagem');
      return { ok: true, message: (r.data?.message as unknown) ?? r.data };
    }

    case 'reply-comment': {
      if (!commentId) throw new Error('commentId obrigatório');
      if (!text) throw new Error('text obrigatório');
      if (!accountId) throw new Error('Conta Late não conectada pra essa plataforma');
      const r = await lateRequest('/inbox/comments/reply', lateApiKey, {
        method: 'POST',
        body: JSON.stringify({
          accountId,
          commentId,
          content: text,
        }),
      });
      if (!r.ok) throw new Error(r.error || 'Falha ao responder comentário');
      return { ok: true, reply: (r.data?.reply as unknown) ?? r.data };
    }

    case 'reply-review': {
      if (!reviewId) throw new Error('reviewId obrigatório');
      if (!text) throw new Error('text obrigatório');
      if (!accountId) throw new Error('Conta Late não conectada pra essa plataforma');
      const r = await lateRequest(
        `/reviews/${encodeURIComponent(reviewId)}/reply`,
        lateApiKey,
        {
          method: 'POST',
          body: JSON.stringify({ accountId, text }),
        },
      );
      if (!r.ok) throw new Error(r.error || 'Falha ao responder review');
      return { ok: true, reply: (r.data?.reply as unknown) ?? r.data };
    }

    case 'mark-conversation': {
      if (!conversationId) throw new Error('conversationId obrigatório');
      if (!accountId) throw new Error('Conta Late não conectada pra essa plataforma');
      // status accepted: 'archived' | 'active'. Aceita 'closed'/'open' por
      // compat com o vocabulário antigo do Metricool.
      const archived = status === 'archived' || status === 'closed';
      const r = await lateRequest(
        `/messages/conversations/${encodeURIComponent(conversationId)}`,
        lateApiKey,
        {
          method: 'PATCH',
          body: JSON.stringify({
            accountId,
            archived,
          }),
        },
      );
      if (!r.ok) throw new Error(r.error || 'Falha ao atualizar conversa');
      return { ok: true, conversation: (r.data?.conversation as unknown) ?? r.data };
    }

    case 'hide-comment': {
      if (!commentId) throw new Error('commentId obrigatório');
      if (!accountId) throw new Error('Conta Late não conectada pra essa plataforma');
      const r = await lateRequest(
        `/inbox/comments/${encodeURIComponent(commentId)}/hide`,
        lateApiKey,
        {
          method: 'PATCH',
          body: JSON.stringify({ accountId }),
        },
      );
      if (!r.ok) throw new Error(r.error || 'Falha ao ocultar comentário');
      return { ok: true };
    }

    default:
      throw new Error(`Mode inválido: ${mode}`);
  }
});

// Helper exportado pra outras rotas (e.g. webhook handler) se precisarem
// resolver credenciais Late do cliente sem reimplementar o lookup.
export { loadLateCredentials, resolveAccountId };

// Silence unused export warning in case nobody imports queryOne.
void queryOne;
