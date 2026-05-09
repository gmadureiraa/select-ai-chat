// Inbox unificado Metricool — DMs + comentários + reviews de todas as plataformas.
// 5 modes:
//   - 'list-conversations' (default)
//   - 'list-comments'
//   - 'list-reviews'
//   - 'send-message'    body: { conversationId, text, mediaUrl? }
//   - 'reply-comment'   body: { commentId, text, network }
//   - 'reply-review'    body: { reviewId, text, network }
//   - 'set-status'      body: { id, status, type:'conversation'|'comment' }
//   - 'delete-comment'  body: { commentId }
import { authedPost } from '../_lib/handler.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  listInboxConversations,
  listPostComments,
  listReviews,
  sendInboxMessage,
  replyToComment,
  replyToReview,
  setInboxStatus,
  deleteComment,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body }) => {
  const { clientId, mode = 'list-conversations', blogId: directBlogId, ...rest } = body;
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  switch (mode) {
    case 'list-conversations': {
      const conversations = await listInboxConversations(cfg, blogId, {
        status: rest.status,
        limit: rest.limit,
        offset: rest.offset,
      });
      return { ok: true, conversations };
    }
    case 'list-comments': {
      const comments = await listPostComments(cfg, blogId, {
        network: rest.network,
        limit: rest.limit,
        offset: rest.offset,
      });
      return { ok: true, comments };
    }
    case 'list-reviews': {
      const reviews = await listReviews(cfg, blogId, { network: rest.network });
      return { ok: true, reviews };
    }
    case 'send-message': {
      if (!rest.conversationId || !rest.text) throw new Error('conversationId e text obrigatórios');
      const r = await sendInboxMessage(cfg, blogId, {
        conversationId: rest.conversationId,
        text: rest.text,
        mediaUrl: rest.mediaUrl,
      });
      return { ok: true, result: r };
    }
    case 'reply-comment': {
      if (!rest.commentId || !rest.text || !rest.network) throw new Error('commentId, text, network obrigatórios');
      const r = await replyToComment(cfg, blogId, {
        commentId: rest.commentId,
        text: rest.text,
        network: rest.network,
      });
      return { ok: true, result: r };
    }
    case 'reply-review': {
      if (!rest.reviewId || !rest.text || !rest.network) throw new Error('reviewId, text, network obrigatórios');
      const r = await replyToReview(cfg, blogId, {
        reviewId: rest.reviewId,
        text: rest.text,
        network: rest.network,
      });
      return { ok: true, result: r };
    }
    case 'set-status': {
      if (!rest.id || !rest.status || !rest.type) throw new Error('id, status, type obrigatórios');
      const r = await setInboxStatus(cfg, blogId, {
        id: rest.id,
        status: rest.status,
        type: rest.type,
      });
      return { ok: true, result: r };
    }
    case 'delete-comment': {
      if (!rest.commentId) throw new Error('commentId obrigatório');
      await deleteComment(cfg, blogId, rest.commentId);
      return { ok: true };
    }
    default:
      throw new Error(`Mode inválido: ${mode}`);
  }
});
