// Retorna best times to post de uma plataforma específica.
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import { getMetricoolConfig, resolveBlogId, getBestTimes, METRICOOL_PLATFORM_MAP } from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, platform = 'instagram', blogId: directBlogId } = body;
  if (clientId) await assertClientAccess(user.id, clientId);
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');
  const network = METRICOOL_PLATFORM_MAP[platform] || platform;
  const bestTimes = await getBestTimes(cfg, blogId, network);
  return { ok: true, network, bestTimes };
});
