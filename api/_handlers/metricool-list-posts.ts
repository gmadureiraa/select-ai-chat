// Lista posts agendados num período.
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import { getMetricoolConfig, resolveBlogId, listScheduledPosts } from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, blogId: directBlogId, startDate, endDate } = body;
  if (!clientId) throw new Error('clientId é obrigatório');
  await assertClientAccess(user.id, clientId);
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  const now = new Date();
  const start = startDate || new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 19);
  const end = endDate || new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 19);

  const posts = await listScheduledPosts(cfg, blogId, start, end);
  return { ok: true, posts, startDate: start, endDate: end };
});
