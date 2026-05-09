// Mapeia um KAI client → Metricool blogId.
// Atualiza/insere `metadata.metricool_blog_id` em todas as
// client_social_credentials desse cliente.
// Body: { clientId, blogId, brandLabel?, autoSync?: boolean }
//   autoSync=true: além de mapear, lê /admin/simpleProfiles e popula
//   metadata com twitter/instagram/facebook/linkedin handles do brand.
import { authedPost } from '../_lib/handler.js';
import { getPool, query } from '../_lib/db.js';
import { getMetricoolConfig, listBrands } from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body }) => {
  const { clientId, blogId, brandLabel, autoSync = true } = body;
  if (!clientId || !blogId) throw new Error('clientId e blogId obrigatórios');

  const cfg = getMetricoolConfig();
  const pool = getPool();

  let resolvedLabel = brandLabel;
  let brandRow: any = null;
  if (autoSync) {
    const brands = await listBrands(cfg);
    brandRow = brands.find((b) => String(b.id) === String(blogId));
    if (!brandRow) throw new Error(`Brand ${blogId} não encontrado na conta Metricool`);
    resolvedLabel = resolvedLabel || brandRow.label;
  }

  // Lista todas as credentials existentes do cliente
  const creds = await query<any>(
    `SELECT id, platform, metadata FROM client_social_credentials WHERE client_id = $1`,
    [clientId],
  );

  let updated = 0;
  for (const c of creds) {
    const newMeta = {
      ...((c.metadata as any) || {}),
      metricool_blog_id: String(blogId),
      metricool_brand_label: resolvedLabel,
    };
    await pool.query(
      `UPDATE client_social_credentials SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(newMeta), c.id],
    );
    updated++;
  }

  // Se autoSync e brand tem handles, popula contas que ainda não existem
  let inserted = 0;
  if (autoSync && brandRow) {
    const platformMap: Array<{ field: string; platform: string }> = [
      { field: 'instagram', platform: 'instagram' },
      { field: 'facebook', platform: 'facebook' },
      { field: 'twitter', platform: 'twitter' },
      { field: 'linkedinCompany', platform: 'linkedin' },
      { field: 'tiktok', platform: 'tiktok' },
      { field: 'youtube', platform: 'youtube' },
      { field: 'threads', platform: 'threads' },
      { field: 'pinterest', platform: 'pinterest' },
    ];
    for (const { field, platform } of platformMap) {
      const handle = brandRow[field];
      if (!handle) continue;
      const exists = creds.find((c: any) => c.platform === platform);
      if (exists) continue;
      const meta = {
        metricool_blog_id: String(blogId),
        metricool_brand_label: resolvedLabel,
        metricool_handle: String(handle),
        provider: 'metricool',
        auto_mapped: true,
        auto_mapped_at: new Date().toISOString(),
      };
      await pool.query(
        `INSERT INTO client_social_credentials (client_id, platform, account_id, account_name, is_valid, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [clientId, platform, String(handle), String(handle), true, JSON.stringify(meta)],
      );
      inserted++;
    }
  }

  return {
    ok: true,
    clientId,
    blogId: String(blogId),
    brandLabel: resolvedLabel,
    credentialsUpdated: updated,
    credentialsInserted: inserted,
  };
});
