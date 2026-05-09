// Realtime stats — valores atuais + sessões ativas.
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import { getMetricoolConfig, resolveBlogId, getRealtimeValues, getRealtimeSessions } from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, blogId: directBlogId } = body;
  if (!clientId) throw new Error('clientId é obrigatório');
  await assertClientAccess(user.id, clientId);
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  const [values, sessions] = await Promise.all([
    getRealtimeValues(cfg, blogId).catch(() => null),
    getRealtimeSessions(cfg, blogId).catch(() => null),
  ]);

  return { ok: true, values, sessions, syncedAt: new Date().toISOString() };
});
