// Hashtags Tracker — listar/criar sessões + ver distribuição.
// Modes: 'list', 'create', 'distribution'
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  listHashtagSessions,
  createHashtagSession,
  getHashtagDistribution,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, mode = 'list', blogId: directBlogId, ...rest } = body;
  if (!clientId) throw new Error('clientId é obrigatório');
  await assertClientAccess(user.id, clientId);
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  if (mode === 'list') {
    return { ok: true, sessions: await listHashtagSessions(cfg, blogId) };
  }
  if (mode === 'create') {
    if (!rest.hashtag || !rest.network) throw new Error('hashtag e network obrigatórios');
    const r = await createHashtagSession(cfg, blogId, {
      hashtag: rest.hashtag,
      network: rest.network,
      durationDays: rest.durationDays,
    });
    return { ok: true, session: r };
  }
  if (mode === 'distribution') {
    if (!rest.sessionId) throw new Error('sessionId obrigatório');
    return { ok: true, distribution: await getHashtagDistribution(cfg, blogId, rest.sessionId) };
  }
  throw new Error(`Mode inválido: ${mode}`);
});
