// Postiz analytics handler — busca métricas (followers/impressions/likes/etc)
// de uma integration via Postiz Public API.
//
// Postiz expõe:
//   GET /analytics/{integrationId}?date={daysBack}    → métricas da plataforma
//   GET /analytics/post/{postId}?date={daysBack}      → métricas de 1 post
//
// Autenticado pelo KAI (user precisa pertencer ao workspace do client).
// Resolve `integrationId` por (clientId, platform) buscando em
// client_social_credentials.metadata.postiz_integration_id.
import { authedPost } from '../_lib/handler.js';
import { queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import {
  getPostizConfig,
  getPlatformAnalytics,
  getPostAnalytics,
  type PostizAnalyticsMetric,
} from '../_lib/integrations/postiz.js';

interface PostizAnalyticsResult {
  ok: boolean;
  integrationId?: string;
  daysBack: number;
  metrics: PostizAnalyticsMetric[];
  source: 'platform' | 'post';
  error?: string;
}

export default authedPost<PostizAnalyticsResult>(async ({ body, user }) => {
  const { clientId, platform, integrationId: directId, postId, daysBack = 30 } = body;
  if (clientId) await assertClientAccess(user.id, clientId);

  let cfg;
  try {
    cfg = getPostizConfig();
  } catch (e: any) {
    return { ok: false, daysBack, metrics: [], source: 'platform', error: e.message };
  }

  // Path 1: analytics de 1 post específico
  if (postId) {
    try {
      const metrics = await getPostAnalytics(cfg, postId, daysBack);
      return { ok: true, daysBack, metrics, source: 'post' };
    } catch (e: any) {
      return { ok: false, daysBack, metrics: [], source: 'post', error: e.message };
    }
  }

  // Path 2: analytics de uma plataforma (precisa integrationId)
  let integrationId = directId as string | undefined;
  if (!integrationId && clientId && platform) {
    const cred = await queryOne<any>(
      `SELECT metadata, account_id FROM client_social_credentials
        WHERE client_id = $1 AND platform = $2 AND is_valid = true LIMIT 1`,
      [clientId, platform],
    );
    if (cred) {
      const meta = (cred.metadata as any) || {};
      integrationId = meta.postiz_integration_id || cred.account_id;
    }
  }

  if (!integrationId) {
    return {
      ok: false,
      daysBack,
      metrics: [],
      source: 'platform',
      error: 'Nenhuma integration_id encontrada. Conecte a conta primeiro.',
    };
  }

  try {
    const metrics = await getPlatformAnalytics(cfg, integrationId, daysBack);
    return { ok: true, integrationId, daysBack, metrics, source: 'platform' };
  } catch (e: any) {
    return { ok: false, integrationId, daysBack, metrics: [], source: 'platform', error: e.message };
  }
});
