// Smart Links Metricool — encurtador URL com tracking + analytics.
// Modes:
//   'list'        — lista todos smart links (full payload)
//   'list-lite'   — lista lite (id, slug, name, imageUrl)
//   'get'         — detalhe de 1 smart link (precisa id)
//   'create'      — cria smart link novo (body livre, ver swagger)
//   'update'      — atualiza smart link (precisa id + body)
//   'delete'      — deleta (precisa id)
//   'slug-check'  — verifica disponibilidade de slug (precisa value)
//   'timeline'    — timeline de uma métrica (precisa id, metric, from, to)
//   'buttons'     — analytics de botões (precisa id, from, to)
//   'images'      — analytics de imagens (precisa id, from, to)
import { authedPost } from '../_lib/handler.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  getSmartLinks,
  getSmartLinksLite,
  getSmartLink,
  createSmartLink,
  updateSmartLink,
  deleteSmartLink,
  isSmartLinkSlugAvailable,
  getSmartLinkTimeline,
  getSmartLinkButtonAnalytics,
  getSmartLinkImageAnalytics,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body }) => {
  const { clientId, mode = 'list', blogId: directBlogId, ...rest } = body;
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  if (mode === 'list') {
    return { ok: true, links: await getSmartLinks(cfg, blogId, rest.slug) };
  }
  if (mode === 'list-lite') {
    return { ok: true, links: await getSmartLinksLite(cfg, blogId) };
  }
  if (mode === 'get') {
    if (!rest.id) throw new Error('id obrigatório');
    return { ok: true, link: await getSmartLink(cfg, blogId, rest.id) };
  }
  if (mode === 'create') {
    if (!rest.body && !rest.payload && !rest.name && !rest.slug) {
      throw new Error('payload (ou name/slug) obrigatório pra criar smart link');
    }
    const payload = rest.body || rest.payload || {
      name: rest.name,
      slug: rest.slug,
      content: rest.content,
      appearance: rest.appearance,
    };
    return { ok: true, link: await createSmartLink(cfg, blogId, payload) };
  }
  if (mode === 'update') {
    if (!rest.id) throw new Error('id obrigatório');
    const payload = rest.body || rest.payload || rest.patch;
    if (!payload) throw new Error('body (patch) obrigatório');
    return { ok: true, link: await updateSmartLink(cfg, blogId, rest.id, payload) };
  }
  if (mode === 'delete') {
    if (!rest.id) throw new Error('id obrigatório');
    await deleteSmartLink(cfg, blogId, rest.id);
    return { ok: true };
  }
  if (mode === 'slug-check') {
    if (!rest.value) throw new Error('value (slug) obrigatório');
    return { ok: true, available: await isSmartLinkSlugAvailable(cfg, blogId, rest.value) };
  }
  if (mode === 'timeline') {
    if (!rest.id) throw new Error('id obrigatório');
    const metric = rest.metric || 'clicks';
    const now = new Date();
    const to = (rest.to as string) || now.toISOString().slice(0, 19);
    const from =
      (rest.from as string) ||
      new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 19);
    return {
      ok: true,
      metric,
      timeline: await getSmartLinkTimeline(cfg, blogId, rest.id, metric, from, to, rest.itemId),
    };
  }
  if (mode === 'buttons') {
    if (!rest.id) throw new Error('id obrigatório');
    const now = new Date();
    const to = (rest.to as string) || now.toISOString().slice(0, 19);
    const from =
      (rest.from as string) ||
      new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 19);
    return { ok: true, buttons: await getSmartLinkButtonAnalytics(cfg, blogId, rest.id, from, to) };
  }
  if (mode === 'images') {
    if (!rest.id) throw new Error('id obrigatório');
    const now = new Date();
    const to = (rest.to as string) || now.toISOString().slice(0, 19);
    const from =
      (rest.from as string) ||
      new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 19);
    return { ok: true, images: await getSmartLinkImageAnalytics(cfg, blogId, rest.id, from, to) };
  }
  throw new Error(`Mode inválido: ${mode}`);
});
