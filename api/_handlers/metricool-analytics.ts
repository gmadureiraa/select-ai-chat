// Metricool analytics — endpoint genérico pra puxar:
//   - posts/reels/stories de uma plataforma específica
//   - timeline de uma métrica
//   - aggregation
//   - brand summary
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  getNetworkPosts,
  getInstagramReels,
  getInstagramStories,
  getFacebookReels,
  getFacebookStories,
  getTimeline,
  getAggregation,
  getBrandSummary,
  type MetricoolAnalyticsNetwork,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, mode = 'posts', blogId: directBlogId, ...rest } = body;
  // Authorization: se o handler recebeu clientId, valida que o user tem acesso.
  // Aceita também `directBlogId` puro pra dev/admin (não traceável a cliente),
  // mas nesse caso quem chama precisa estar autenticado e o handler retorna
  // só dados que o blog Metricool já tem público.
  if (clientId) await assertClientAccess(user.id, clientId);
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  const now = new Date();
  const from = (rest.from as string) || new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 19);
  const to = (rest.to as string) || now.toISOString().slice(0, 19);

  switch (mode) {
    case 'posts': {
      if (!rest.network) throw new Error('network obrigatório');
      const posts = await getNetworkPosts(cfg, blogId, rest.network as MetricoolAnalyticsNetwork, from, to);
      return { ok: true, network: rest.network, posts, from, to };
    }
    case 'reels': {
      const network = rest.network || 'instagram';
      const fetcher = network === 'facebook' ? getFacebookReels : getInstagramReels;
      return { ok: true, network, reels: await fetcher(cfg, blogId, from, to), from, to };
    }
    case 'stories': {
      const network = rest.network || 'instagram';
      const fetcher = network === 'facebook' ? getFacebookStories : getInstagramStories;
      return { ok: true, network, stories: await fetcher(cfg, blogId, from, to), from, to };
    }
    case 'timeline': {
      if (!rest.network || !rest.metric) {
        throw new Error('network e metric obrigatórios (ex: network=facebook, metric=pageFollows)');
      }
      return {
        ok: true,
        network: rest.network,
        metric: rest.metric,
        ...(rest.subject ? { subject: rest.subject } : {}),
        timeline: await getTimeline(
          cfg,
          blogId,
          rest.network,
          rest.metric,
          from,
          to,
          rest.timezone,
          rest.subject,
        ),
      };
    }
    case 'aggregation': {
      if (!rest.metric) throw new Error('metric obrigatório');
      return { ok: true, metric: rest.metric, data: await getAggregation(cfg, blogId, rest.metric, from, to) };
    }
    case 'brand-summary': {
      return { ok: true, summary: await getBrandSummary(cfg, blogId, from, to) };
    }
    default:
      throw new Error(`Mode inválido: ${mode}`);
  }
});
