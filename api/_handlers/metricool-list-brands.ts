// Lista todas as brands (= clientes) da conta Metricool.
// Usado pra mapear KAI client → Metricool blogId no Settings.
import { authedPost } from '../_lib/handler.js';
import { getMetricoolConfig, listBrands } from '../_lib/integrations/metricool.js';

export default authedPost(async () => {
  const cfg = getMetricoolConfig();
  const brands = await listBrands(cfg);
  return {
    ok: true,
    brands: brands.map((b) => ({
      id: b.id,
      label: b.label,
      url: b.url,
      picture: b.picture,
      timezone: b.timezone,
      ownerId: b.ownerId,
      role: b.role,
    })),
  };
});
