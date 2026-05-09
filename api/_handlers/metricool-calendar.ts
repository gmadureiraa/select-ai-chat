// Metricool Calendar handler — system calendars (datas comemorativas/holidays)
// + user calendars (ICS subscritos pelo cliente). Eventos mensais/range.
//
// Modes:
//   list           — lista calendários system disponíveis (público)
//   assigned       — calendários assinados (system+user) da brand
//   events         — eventos num período (precisa calendarId+initDate+endDate)
//   create         — cria user calendar (ICS URL pública) e atribui ao blog
//   assign         — atribui um system calendar à brand
//   unassign       — remove atribuição
//   refresh        — refresh cache do user calendar
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  listSystemCalendars,
  listAssignedCalendars,
  getCalendarEvents,
  createUserCalendar,
  assignCalendarToBlog,
  unassignCalendarFromBlog,
  refreshCalendarCache,
} from '../_lib/integrations/metricool.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, mode = 'assigned', blogId: directBlogId, ...rest } = body;
  const cfg = getMetricoolConfig();

  // mode 'list' (system catalog) não exige blogId nem clientId — público.
  if (mode === 'list') {
    const calendars = await listSystemCalendars(cfg, rest.language || 'pt');
    return { ok: true, calendars };
  }

  if (!clientId) throw new Error('clientId é obrigatório');
  await assertClientAccess(user.id, clientId);

  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) throw new Error('Cliente sem blog Metricool mapeado');

  if (mode === 'assigned') {
    const calendars = await listAssignedCalendars(cfg, blogId, rest.language || 'pt');
    return { ok: true, calendars };
  }

  if (mode === 'events') {
    const { calendarId, initDate, endDate, timeZone } = rest;
    if (!calendarId) throw new Error('calendarId obrigatório');
    if (!initDate || !endDate) throw new Error('initDate e endDate obrigatórios');
    const events = await getCalendarEvents(
      cfg,
      blogId,
      calendarId,
      initDate,
      endDate,
      timeZone || 'America/Sao_Paulo',
    );
    return { ok: true, events };
  }

  if (mode === 'events-multi') {
    // Conveniência: fetch eventos de múltiplos calendars em paralelo.
    const { calendarIds, initDate, endDate, timeZone } = rest;
    if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
      throw new Error('calendarIds (array) obrigatório');
    }
    if (!initDate || !endDate) throw new Error('initDate e endDate obrigatórios');
    const tz = timeZone || 'America/Sao_Paulo';
    const results = await Promise.all(
      calendarIds.map(async (cid: string | number) => {
        try {
          const events = await getCalendarEvents(cfg, blogId, cid, initDate, endDate, tz);
          return events.map((e) => ({ ...e, calendarId: cid }));
        } catch {
          return [];
        }
      }),
    );
    const events = results.flat();
    return { ok: true, events };
  }

  if (mode === 'create') {
    const { name, url, description, language, publicCalendar, aggregationFrom } = rest;
    if (!name) throw new Error('name obrigatório');
    if (!url) throw new Error('url obrigatório (link público .ics)');
    const calendar = await createUserCalendar(cfg, blogId, {
      name,
      url,
      description,
      language,
      publicCalendar,
      aggregationFrom,
    });
    return { ok: true, calendar };
  }

  if (mode === 'assign') {
    if (!rest.calendarId) throw new Error('calendarId obrigatório');
    const r = await assignCalendarToBlog(
      cfg,
      blogId,
      rest.calendarId,
      rest.aggregationFrom || 'blog',
    );
    return { ok: true, result: r };
  }

  if (mode === 'unassign') {
    if (!rest.calendarId) throw new Error('calendarId obrigatório');
    const r = await unassignCalendarFromBlog(
      cfg,
      blogId,
      rest.calendarId,
      rest.aggregationFrom || 'blog',
    );
    return { ok: true, result: r };
  }

  if (mode === 'refresh') {
    if (!rest.calendarId) throw new Error('calendarId obrigatório');
    const r = await refreshCalendarCache(cfg, blogId, rest.calendarId);
    return { ok: true, result: r };
  }

  throw new Error(`Mode inválido: ${mode}`);
});
