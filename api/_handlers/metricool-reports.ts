// Metricool Reports handler — Performance Dashboards + relatórios PDF/CSV.
// Modes:
//   list             — lista Performance Dashboards + histórico de reports
//   get              — detalhes de um dashboard específico (+ analytics opcional)
//   generate         — cria novo Performance Dashboard (= "gerar relatório")
//   delete           — remove dashboard
//   sync             — força sync de analytics
//   insights         — IA insights de um dashboard
//   best-posts       — top posts do dashboard
//   templates        — lista templates customizados (/stats/report/reporttemplateName)
//   status           — checa status de job de geração de PDF
import { authedPost } from '../_lib/handler.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  listPerformanceDashboards,
  createPerformanceDashboard,
  getPerformanceDashboard,
  deletePerformanceDashboard,
  syncPerformanceDashboard,
  getPerformanceDashboardAnalytics,
  getPerformanceDashboardInsights,
  getPerformanceDashboardBestPosts,
  listBrandReports,
  getBrandReportStatus,
  listReportTemplates,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body }) => {
  const { clientId, mode = 'list', blogId: directBlogId, ...rest } = body;
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  if (mode === 'list') {
    const [dashboards, history] = await Promise.all([
      listPerformanceDashboards(cfg, blogId).catch(() => []),
      listBrandReports(cfg, blogId).catch(() => []),
    ]);
    return { ok: true, dashboards, history };
  }

  if (mode === 'get') {
    if (!rest.dashboardId) throw new Error('dashboardId obrigatório');
    const [dashboard, analytics] = await Promise.all([
      getPerformanceDashboard(cfg, blogId, rest.dashboardId),
      rest.includeAnalytics
        ? getPerformanceDashboardAnalytics(cfg, blogId, rest.dashboardId, rest.networks).catch(() => null)
        : Promise.resolve(null),
    ]);
    return { ok: true, dashboard, analytics };
  }

  if (mode === 'generate') {
    const { title, description, from, to, networks, timezone, autoCategorize } = rest;
    if (!title) throw new Error('title obrigatório');
    if (!description) throw new Error('description obrigatório');
    if (!from || !to) throw new Error('from e to obrigatórios');
    if (!Array.isArray(networks) || networks.length === 0) {
      throw new Error('networks obrigatório (array)');
    }
    const dashboard = await createPerformanceDashboard(cfg, blogId, {
      title,
      description,
      from,
      to,
      networks,
      timezone,
      autoCategorize,
    });
    return { ok: true, dashboard };
  }

  if (mode === 'delete') {
    if (!rest.dashboardId) throw new Error('dashboardId obrigatório');
    await deletePerformanceDashboard(cfg, blogId, rest.dashboardId);
    return { ok: true };
  }

  if (mode === 'sync') {
    if (!rest.dashboardId) throw new Error('dashboardId obrigatório');
    const r = await syncPerformanceDashboard(cfg, blogId, rest.dashboardId);
    return { ok: true, sync: r };
  }

  if (mode === 'insights') {
    if (!rest.dashboardId) throw new Error('dashboardId obrigatório');
    const insights = await getPerformanceDashboardInsights(cfg, blogId, rest.dashboardId);
    return { ok: true, insights };
  }

  if (mode === 'best-posts') {
    if (!rest.dashboardId) throw new Error('dashboardId obrigatório');
    const bestPosts = await getPerformanceDashboardBestPosts(
      cfg,
      blogId,
      rest.dashboardId,
      rest.metric,
    );
    return { ok: true, bestPosts };
  }

  if (mode === 'templates') {
    const templates = await listReportTemplates(cfg);
    return { ok: true, templates };
  }

  if (mode === 'status') {
    if (!rest.jobId) throw new Error('jobId obrigatório');
    const status = await getBrandReportStatus(cfg, blogId, String(rest.jobId));
    return { ok: true, status };
  }

  throw new Error(`Mode inválido: ${mode}`);
});
