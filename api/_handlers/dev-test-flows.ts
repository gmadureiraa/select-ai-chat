// Handler dev pra testar fluxos críticos end-to-end SEM precisar de JWT real.
// Auth: somente CRON_SECRET (mesma que crons usam). Não exposto pra users.
//
// Body:
//   { flow: 'gen-carousel' | 'check-env' | 'check-tables' | 'check-carousel-deps',
//     clientId?: string, briefing?: string, slideCount?: number }
//
// Retorna: { ok, flow, durationMs, result?, error? }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';

const GABRIEL_USER_ID = '5014248e-b1ac-4306-8490-2644dcd8aeb5';
const GABRIEL_EMAIL = 'gf.madureiraa@gmail.com';
const KALEIDOS_WORKSPACE = '11111111-1111-1111-1111-111111111111';
const MADUREIRA_CLIENT = '14bf8576-7104-48ca-962d-014308e45a4e';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth: CRON_SECRET (debug only)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonError(res, 401, 'Need CRON_SECRET bearer');
  }

  const body = (req.body ?? {}) as Record<string, any>;
  const flow = body.flow as string;
  const clientId = (body.clientId as string) ?? MADUREIRA_CLIENT;

  const t0 = Date.now();
  const log: string[] = [];
  const errors: string[] = [];

  function step(msg: string) {
    log.push(`[${Date.now() - t0}ms] ${msg}`);
  }

  try {
    if (flow === 'gen-carousel') {
      step('start gen-carousel — full pipeline test');
      const briefing = (body.briefing as string) ?? 'Como criar carrosseis virais com IA';
      const slideCount = (body.slideCount as number) ?? 5;
      const tone = (body.tone as string) ?? 'direto';

      // Import the handler directly and invoke it with a mock req/res.
      // Auth bypass: we set `x-internal-call: true` + pass `userId` explicitly.
      // generate-viral-carousel.ts already handles that path (lines 339–355).
      const mod: any = await import('./generate-viral-carousel.js');
      step('imported generate-viral-carousel');

      let payload: any = null;
      let statusCode = 200;
      const mockReq: any = {
        method: 'POST',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
          'x-internal-call': 'true',
        },
        body: {
          clientId,
          briefing,
          slideCount,
          tone,
          persistAs: 'both',
          source: 'manual',
          userId: GABRIEL_USER_ID,
        },
        query: {},
      };
      const mockRes: any = {
        statusCode: 200,
        headersSent: false,
        setHeader: () => mockRes,
        status(c: number) { this.statusCode = c; statusCode = c; return this; },
        json(p: any) { payload = p; this.headersSent = true; return this; },
        end() { this.headersSent = true; return this; },
      };

      step('calling generate-viral-carousel handler...');
      await mod.default(mockReq, mockRes);
      step(`handler returned status=${statusCode}`);

      if (statusCode >= 400) {
        errors.push(`carousel handler returned ${statusCode}: ${JSON.stringify(payload).slice(0, 500)}`);
      }

      // Validate persistence
      const pool = getPool();
      let viralCount = 0;
      let planCount = 0;
      let viewCount = 0;
      let carouselRow: any = null;
      let planningRow: any = null;
      try {
        const v = await pool.query(`SELECT count(*)::int as c FROM viral_carousels`);
        viralCount = v.rows[0].c;
        step(`viral_carousels rows: ${viralCount}`);

        const p = await pool.query(`SELECT count(*)::int as c FROM planning_items WHERE content_type = 'viral_carousel'`);
        planCount = p.rows[0].c;
        step(`planning_items (viral) rows: ${planCount}`);

        const view = await pool.query(`SELECT count(*)::int as c FROM carousels`);
        viewCount = view.rows[0].c;
        step(`carousels view rows: ${viewCount}`);

        if (payload?.carouselId) {
          const cr = await pool.query(
            `SELECT id, title, briefing, jsonb_array_length(slides) AS slide_count, status, source, created_at
               FROM viral_carousels WHERE id = $1`,
            [payload.carouselId]
          );
          carouselRow = cr.rows[0] ?? null;
          step(`fetched carousel row: ${carouselRow ? 'OK' : 'MISSING'}`);
        }
        if (payload?.planningItemId) {
          const pr = await pool.query(
            `SELECT id, title, content_type, status, created_at
               FROM planning_items WHERE id = $1`,
            [payload.planningItemId]
          );
          planningRow = pr.rows[0] ?? null;
          step(`fetched planning row: ${planningRow ? 'OK' : 'MISSING'}`);
        }
      } catch (e: any) {
        errors.push(`db validation: ${e?.message}`);
      }

      // Validate slides have non-empty bodies
      const slides = payload?.slides ?? [];
      const emptyBodies = slides.filter((s: any) => !s?.body?.trim()).length;
      if (slides.length === 0) {
        errors.push('handler returned 0 slides');
      } else if (emptyBodies > 0) {
        errors.push(`${emptyBodies}/${slides.length} slides have empty body`);
      }

      return res.status(200).json({
        ok: errors.length === 0 && statusCode === 200,
        flow,
        durationMs: Date.now() - t0,
        statusCode,
        carouselId: payload?.carouselId ?? null,
        planningItemId: payload?.planningItemId ?? null,
        slidesReturned: slides.length,
        slidesPreview: slides.map((s: any, i: number) => ({
          order: i + 1,
          bodyLen: s?.body?.length ?? 0,
          bodyHead: (s?.body ?? '').slice(0, 80),
        })),
        viralCount,
        planCount,
        viewCount,
        carouselRow,
        planningRow,
        log,
        errors,
        rawPayload: errors.length > 0 ? payload : undefined,
      });
    }

    if (flow === 'check-carousel-deps') {
      step('start check-carousel-deps');
      const pool = getPool();
      const clientRow = await queryOne(
        `SELECT id, name, workspace_id FROM clients WHERE id = $1`,
        [clientId],
      );
      step(`client lookup: ${clientRow ? 'found' : 'NOT FOUND'}`);
      if (!clientRow) errors.push('client not found');

      const wsRow = await queryOne(
        `SELECT id FROM workspaces WHERE id = $1`,
        [KALEIDOS_WORKSPACE],
      );
      step(`workspace lookup: ${wsRow ? 'found' : 'NOT FOUND'}`);

      const subRow = await queryOne(
        `SELECT sp.type AS plan_type FROM workspace_subscriptions ws
           LEFT JOIN subscription_plans sp ON sp.id = ws.plan_id
          WHERE ws.workspace_id = $1 AND ws.status = 'active' LIMIT 1`,
        [KALEIDOS_WORKSPACE],
      );
      step(`subscription: ${(subRow as any)?.plan_type ?? 'none'}`);

      const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_STUDIO_API_KEY;
      step(`gemini key: ${geminiKey ? 'present (len ' + geminiKey.length + ')' : 'MISSING'}`);
      if (!geminiKey) errors.push('GEMINI_API_KEY missing');

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      step(`blob token: ${blobToken ? 'present' : 'MISSING'}`);

      try {
        const v = await pool.query(`SELECT count(*)::int as c FROM carousels`);
        step(`carousels view: ${v.rows[0].c} rows`);
      } catch (e: any) {
        errors.push(`carousels view query: ${e?.message}`);
      }

      // check-tokens function
      try {
        const ct = await pool.query(
          `SELECT public.check_tokens($1) AS result`,
          [KALEIDOS_WORKSPACE],
        );
        step(`check_tokens result: ${JSON.stringify(ct.rows[0]?.result ?? null).slice(0, 100)}`);
      } catch (e: any) {
        step(`check_tokens NOT AVAILABLE: ${e?.message}`);
      }
    }

    if (flow === 'check-tables') {
      const pool = getPool();
      const tables = [
        'workspaces', 'clients', 'planning_items', 'team_tasks',
        'client_content_library', 'client_reference_library',
        'viral_carousels', 'viral_reels', 'viral_radar_briefs',
        'ai_agents', 'ai_workflows', 'ai_workflow_runs',
        'planning_automations', 'subscription_plans', 'workspace_subscriptions',
        'workspace_tokens', 'super_admins', 'profiles',
        'radar_saved_items', 'radar_newsletters_curated',
        'viral_tracked_sources', 'viral_news_articles',
        'library_ideas', 'library_reels',
      ];
      const results: Record<string, any> = {};
      for (const t of tables) {
        try {
          const r = await pool.query(`SELECT count(*)::int as c FROM ${t}`);
          results[t] = r.rows[0].c;
          step(`${t}: ${results[t]}`);
        } catch (e: any) {
          results[t] = `ERROR: ${e?.message}`;
          errors.push(`${t}: ${e?.message}`);
        }
      }
      return res.status(200).json({
        ok: errors.length === 0,
        flow,
        durationMs: Date.now() - t0,
        tables: results,
        log,
        errors,
      });
    }

    if (flow === 'check-env') {
      const required = [
        'DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY',
        'GOOGLE_AI_STUDIO_API_KEY', 'OPENAI_API_KEY', 'APIFY_API_KEY',
        'NEON_JWKS_URL', 'CRON_SECRET',
        'POSTIZ_API_KEY', 'STRIPE_SECRET_KEY', 'VAPID_PUBLIC_KEY',
      ];
      const env: Record<string, string> = {};
      for (const k of required) {
        const v = process.env[k];
        env[k] = v ? `present (len ${v.length})` : 'MISSING';
      }
      return res.status(200).json({
        ok: true,
        flow,
        env,
        durationMs: Date.now() - t0,
      });
    }

    return res.status(200).json({
      ok: errors.length === 0,
      flow,
      durationMs: Date.now() - t0,
      log,
      errors,
      auth: { id: GABRIEL_USER_ID, email: GABRIEL_EMAIL },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      flow,
      error: err?.message ?? 'unknown',
      stack: err?.stack?.split('\n').slice(0, 5),
      log,
      errors,
      durationMs: Date.now() - t0,
    });
  }
}
