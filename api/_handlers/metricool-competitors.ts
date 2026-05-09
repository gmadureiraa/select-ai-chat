// Competitors Analysis — listar / adicionar / posts.
// Modes: 'list', 'add', 'posts'
import { authedPost } from '../_lib/handler.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  listCompetitors,
  addCompetitor,
  getCompetitorPosts,
  METRICOOL_PLATFORM_MAP,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body }) => {
  const { clientId, mode = 'list', network: rawNet = 'instagram', blogId: directBlogId, ...rest } = body;
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');
  const network = METRICOOL_PLATFORM_MAP[rawNet] || rawNet;

  if (mode === 'list') {
    return { ok: true, network, competitors: await listCompetitors(cfg, blogId, network) };
  }
  if (mode === 'add') {
    if (!rest.username) throw new Error('username obrigatório');
    return {
      ok: true,
      competitor: await addCompetitor(cfg, blogId, network, {
        username: rest.username,
        name: rest.name,
      }),
    };
  }
  if (mode === 'posts') {
    if (!rest.competitorId) throw new Error('competitorId obrigatório');
    const now = new Date();
    const from = (rest.from as string) || new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 19);
    const to = (rest.to as string) || now.toISOString().slice(0, 19);
    return {
      ok: true,
      posts: await getCompetitorPosts(cfg, blogId, network, rest.competitorId, from, to),
    };
  }
  throw new Error(`Mode inválido: ${mode}`);
});
