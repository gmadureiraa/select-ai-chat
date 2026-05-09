// Fetch metrics (likes/comments/reach/impressions/etc) de UM post publicado
// e atualiza `planning_items.metadata.metrics`.
//
// Body aceita:
//   - planningItemId — resolve external_post_id automaticamente
//   - postId + clientId/blogId — usa direto (caso post não esteja no planning)
//   - force — ignora cache de 12h
//
// Estratégia Metricool: lista posts da plataforma do post (via getNetworkPosts)
// no range [published_at - 1d, NOW()] e procura match por id.
// Em fallback (sem network ou cliente), tenta listScheduledPosts mas esses
// não vêm com analytics — só status/url.
//
// Postiz/Late: hooks deixados como TODO (planning v2 atual usa metricool por padrão).
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import { getPool, queryOne } from '../_lib/db.js';
import {
  getMetricoolConfig,
  getNetworkPosts,
  getInstagramReels,
  getFacebookReels,
  getInstagramStories,
  getFacebookStories,
  resolveBlogId,
  normalizeMetrics,
  type MetricoolPostMetrics,
  type MetricoolAnalyticsNetwork,
  type NormalizedPostMetrics,
} from '../_lib/integrations/metricool.js';

// Gap #9 — normalizeMetrics agora vive em api/_lib/integrations/metricool.ts.
export type PlanningPostMetrics = NormalizedPostMetrics;

interface FetchResult {
  ok: boolean;
  source: 'metricool' | 'cache' | 'unsupported';
  metrics?: PlanningPostMetrics;
  planningItemId?: string;
  postId?: string;
  message?: string;
  error?: string;
}

const MIN_RESYNC_HOURS = 12;

function networkForPlatform(platform: string | null | undefined): MetricoolAnalyticsNetwork | null {
  if (!platform) return null;
  const map: Record<string, MetricoolAnalyticsNetwork> = {
    instagram: 'instagram',
    facebook: 'facebook',
    twitter: 'twitter',
    linkedin: 'linkedin',
    tiktok: 'tiktok',
    threads: 'threads',
    youtube: 'youtube',
  };
  return map[platform] ?? null;
}

export default authedPost(async ({ body, user }): Promise<FetchResult> => {
  const {
    planningItemId,
    postId: directPostId,
    clientId: directClientId,
    blogId: directBlogId,
    platform: directPlatform,
    force = false,
  } = body || {};

  let cfg;
  try {
    cfg = getMetricoolConfig();
  } catch (e: any) {
    return { ok: false, source: 'metricool', error: e.message };
  }

  const pool = getPool();

  // 1. Resolve item alvo (se planningItemId)
  let item: any = null;
  if (planningItemId) {
    item = await queryOne<any>(
      `SELECT id, client_id, platform, external_post_id, published_at, metadata, status
         FROM planning_items
        WHERE id = $1
        LIMIT 1`,
      [planningItemId],
    );
    if (!item) {
      return { ok: false, source: 'metricool', error: 'planning_item not found' };
    }
  }

  const meta = (item?.metadata as Record<string, any>) || {};
  const postId =
    directPostId || item?.external_post_id || (meta.metricool_post_id as string | undefined);
  if (!postId) {
    return { ok: false, source: 'metricool', error: 'sem postId — item ainda não publicado via metricool' };
  }

  // 2. Cache: se já tem metrics e last_synced_at < MIN_RESYNC_HOURS atrás, retorna
  if (item && !force && meta.metrics?.last_synced_at) {
    const last = new Date(meta.metrics.last_synced_at).getTime();
    const ageH = (Date.now() - last) / 3600_000;
    if (ageH < MIN_RESYNC_HOURS) {
      return {
        ok: true,
        source: 'cache',
        planningItemId: item.id,
        postId,
        metrics: meta.metrics as PlanningPostMetrics,
      };
    }
  }

  // 3. Resolve blogId + platform
  const clientId = directClientId || item?.client_id;
  if (!clientId) {
    return { ok: false, source: 'metricool', error: 'clientId não pôde ser resolvido' };
  }
  await assertClientAccess(user.id, clientId);
  const platform = directPlatform || item?.platform || meta.target_platforms?.[0];
  const network = networkForPlatform(platform);
  if (!network) {
    return {
      ok: false,
      source: 'unsupported',
      error: `platform '${platform}' não suportada no analytics Metricool`,
    };
  }

  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) {
    return { ok: false, source: 'metricool', error: 'cliente sem blog Metricool mapeado' };
  }

  // 4. Define janela de busca
  const publishedAt = item?.published_at ? new Date(item.published_at) : new Date(Date.now() - 90 * 86400_000);
  // Metricool /v2/analytics/posts costuma exigir intervalos relativos; pegamos +-1d
  // de margem em volta de published_at, e até NOW().
  const from = new Date(publishedAt.getTime() - 86400_000).toISOString().slice(0, 19);
  const to = new Date().toISOString().slice(0, 19);

  // Gap #3 — detecção robusta por contentType + instagramData.type / facebookData.type
  const rawContentType = String(
    meta.contentType ?? meta.content_type ?? meta.instagramData?.type ?? meta.facebookData?.type ?? '',
  ).toLowerCase();
  const isReel = rawContentType === 'reel' || rawContentType === 'reels';
  const isStory = rawContentType === 'story' || rawContentType === 'stories';

  async function fetchAnalyticsByKind(): Promise<MetricoolPostMetrics[]> {
    if (isStory && (network === 'instagram' || network === 'facebook')) {
      return network === 'instagram'
        ? await getInstagramStories(cfg, blogId, from, to)
        : await getFacebookStories(cfg, blogId, from, to);
    }
    if (isReel && (network === 'instagram' || network === 'facebook')) {
      return network === 'instagram'
        ? await getInstagramReels(cfg, blogId, from, to)
        : await getFacebookReels(cfg, blogId, from, to);
    }
    return await getNetworkPosts(cfg, blogId, network, from, to);
  }

  let analyticsPosts: MetricoolPostMetrics[] = [];
  try {
    analyticsPosts = await fetchAnalyticsByKind();
  } catch (e: any) {
    return { ok: false, source: 'metricool', error: e.message };
  }

  // Fallback IG: se platform=instagram e não achou no shape default, tenta reels
  // (cobre casos antigos sem contentType salvo no metadata).
  let found = analyticsPosts.find((p) => String(p.id) === String(postId));
  if (!found && network === 'instagram' && !isReel && !isStory) {
    try {
      const reels = await getInstagramReels(cfg, blogId, from, to);
      const r = reels.find((p) => String(p.id) === String(postId));
      if (r) found = r;
    } catch {
      /* ignore */
    }
  }

  if (!found) {
    return {
      ok: false,
      source: 'metricool',
      postId: String(postId),
      error: 'post não encontrado no analytics Metricool (ainda agregando ou fora da janela)',
    };
  }

  const metrics = normalizeMetrics(found);

  // 5. Persiste em planning_items.metadata.metrics se houver item
  if (item) {
    const newMeta = {
      ...meta,
      metrics,
      metrics_synced_at: metrics.last_synced_at,
    };
    await pool.query(
      `UPDATE planning_items
          SET metadata = $1::jsonb,
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(newMeta), item.id],
    );
  }

  return {
    ok: true,
    source: 'metricool',
    planningItemId: item?.id,
    postId: String(postId),
    metrics,
  };
});
