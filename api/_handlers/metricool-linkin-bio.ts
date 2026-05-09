// Linkin Bio Metricool — gestão da página link-in-bio do Instagram.
// Modes:
//   'get'              — retorna { catalog, buttons }
//   'list-catalog'     — só catálogo de imagens (posts)
//   'list-buttons'     — só botões (texto + link)
//   'add-catalog'      — adiciona imagem ao catálogo (params: picture? igid? timestamp?)
//   'add-button'       — adiciona botão (params: textButton, link)
//   'edit-catalog'     — edita link de imagem (params: itemid, link)
//   'edit-button'      — edita botão (params: itemid, link?, text?)
//   'reorder'          — atualiza posição de botão (params: itemid)
//   'delete-catalog'   — deleta imagem (params: itemid)
//   'delete-button'    — deleta botão (params: itemid)
import { authedPost } from '../_lib/handler.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  getInstagramBioCatalog,
  getInstagramBioButtons,
  addInstagramBioCatalogItem,
  addInstagramBioButton,
  editInstagramBioCatalogItem,
  editInstagramBioButton,
  updateInstagramBioButtonPosition,
  deleteInstagramBioCatalogImage,
  deleteInstagramBioButton,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body }) => {
  const { clientId, mode = 'get', blogId: directBlogId, ...rest } = body;
  const cfg = getMetricoolConfig();
  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  if (mode === 'get') {
    const [catalog, buttons] = await Promise.all([
      getInstagramBioCatalog(cfg, blogId).catch(() => []),
      getInstagramBioButtons(cfg, blogId).catch(() => []),
    ]);
    return { ok: true, catalog, buttons };
  }
  if (mode === 'list-catalog') {
    return { ok: true, catalog: await getInstagramBioCatalog(cfg, blogId) };
  }
  if (mode === 'list-buttons') {
    return { ok: true, buttons: await getInstagramBioButtons(cfg, blogId) };
  }
  if (mode === 'add-catalog') {
    return {
      ok: true,
      catalog: await addInstagramBioCatalogItem(cfg, blogId, {
        picture: rest.picture,
        igid: rest.igid,
        timestamp: rest.timestamp,
      }),
    };
  }
  if (mode === 'add-button') {
    if (!rest.textButton || !rest.link) {
      throw new Error('textButton e link obrigatórios');
    }
    return {
      ok: true,
      buttons: await addInstagramBioButton(cfg, blogId, {
        textButton: rest.textButton,
        link: rest.link,
      }),
    };
  }
  if (mode === 'edit-catalog') {
    if (!rest.itemid || !rest.link) throw new Error('itemid e link obrigatórios');
    return {
      ok: true,
      catalog: await editInstagramBioCatalogItem(cfg, blogId, rest.itemid, rest.link),
    };
  }
  if (mode === 'edit-button') {
    if (!rest.itemid) throw new Error('itemid obrigatório');
    return {
      ok: true,
      buttons: await editInstagramBioButton(cfg, blogId, rest.itemid, {
        link: rest.link,
        text: rest.text,
      }),
    };
  }
  if (mode === 'reorder') {
    if (!rest.itemid) throw new Error('itemid obrigatório');
    return {
      ok: true,
      buttons: await updateInstagramBioButtonPosition(cfg, blogId, rest.itemid),
    };
  }
  if (mode === 'delete-catalog') {
    if (!rest.itemid) throw new Error('itemid obrigatório');
    return {
      ok: true,
      catalog: await deleteInstagramBioCatalogImage(cfg, blogId, rest.itemid),
    };
  }
  if (mode === 'delete-button') {
    if (!rest.itemid) throw new Error('itemid obrigatório');
    return {
      ok: true,
      buttons: await deleteInstagramBioButton(cfg, blogId, rest.itemid),
    };
  }
  throw new Error(`Mode inválido: ${mode}`);
});
