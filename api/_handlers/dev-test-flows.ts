// Handler dev pra testar fluxos críticos end-to-end SEM precisar de JWT real.
// Auth: somente CRON_SECRET (mesma que crons usam). Não exposto pra users.
//
// Body:
//   { flow: 'gen-carousel' | 'gen-reel' | 'gen-radar-brief' | 'kai-chat' |
//           'check-env' | 'check-tables' | 'check-carousel-deps',
//     clientId?: string, briefing?: string, slideCount?: number }
//
// Retorna: { ok, flow, durationMs, result?, error? }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';

/**
 * Invoke a real handler (`authedPost(...)` / SSE handler) by mocking req+res.
 * Auth bypass via `x-internal-cron-secret` + `x-internal-user-id` headers
 * understood by `verifyAuth` / `tryAuth`.
 */
async function invokeRealHandler(
  handlerModule: any,
  payload: Record<string, any>,
  cronSecret: string,
  userId: string,
  capture: 'json' | 'sse' = 'json',
): Promise<{ status: number; body: any; sseChunks: string[] }> {
  const sseChunks: string[] = [];
  let captured: any = null;
  let status = 200;

  const mockReq: any = {
    method: 'POST',
    url: '/api/_internal-bypass',
    headers: {
      'content-type': 'application/json',
      'x-internal-cron-secret': cronSecret,
      'x-internal-user-id': userId,
    },
    body: payload,
    query: {},
  };
  const mockRes: any = {
    statusCode: 200,
    writableEnded: false,
    setHeader: () => mockRes,
    getHeader: () => undefined,
    flushHeaders: () => {},
    write: (chunk: any) => {
      if (capture === 'sse') {
        sseChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
      }
      return true;
    },
    status(c: number) { this.statusCode = c; status = c; return this; },
    json(p: any) { captured = p; this.writableEnded = true; return this; },
    send(p: any) { captured = p; this.writableEnded = true; return this; },
    end() { this.writableEnded = true; return this; },
    on: () => mockRes,
  };

  const fn = handlerModule.default || handlerModule;
  await fn(mockReq, mockRes);
  return { status, body: captured, sseChunks };
}

const GABRIEL_USER_ID = '5014248e-b1ac-4306-8490-2644dcd8aeb5';
const GABRIEL_EMAIL = 'gf.madureiraa@gmail.com';
const KALEIDOS_WORKSPACE = '11111111-1111-1111-1111-111111111111';
const MADUREIRA_CLIENT = '14bf8576-7104-48ca-962d-014308e45a4e';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
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

    if (flow === 'gen-reel') {
      step('start gen-reel — adapt-viral-reel real handler');
      const referenceUrl = body.referenceUrl as string;
      const tema = (body.tema as string) ?? 'Como criar carrosseis virais';
      const objetivo = (body.objetivo as string) ?? 'leads';
      const cta = (body.cta as string) ?? 'comenta CARROSSEL';
      const persona = body.persona as string | undefined;
      const nicho = body.nicho as string | undefined;

      if (!referenceUrl) {
        errors.push('referenceUrl obrigatório');
        return res.status(400).json({ ok: false, flow, errors, log });
      }

      const mod: any = await import('./adapt-viral-reel.js');
      step('imported adapt-viral-reel');

      const out = await invokeRealHandler(
        mod,
        { clientId, sourceUrl: referenceUrl, tema, objetivo, cta, persona, nicho },
        cronSecret,
        GABRIEL_USER_ID,
      );
      step(`adapt-viral-reel returned status=${out.status}`);

      if (out.status >= 400) {
        errors.push(`adapt-viral-reel ${out.status}: ${JSON.stringify(out.body).slice(0, 600)}`);
      }

      // Validate persistence
      const pool = getPool();
      let reelRow: any = null;
      const reelId: string | undefined = out.body?.reelId;
      if (reelId) {
        try {
          const r = await pool.query(
            `SELECT id, status, source_url, source_short_code, tema, objetivo, cta,
                    (analysis IS NOT NULL) AS has_analysis,
                    (script IS NOT NULL) AS has_script,
                    error_message, duration_ms, created_at
               FROM viral_reels WHERE id = $1`,
            [reelId],
          );
          reelRow = r.rows[0] ?? null;
          step(`reel row: ${reelRow ? `status=${reelRow.status}` : 'MISSING'}`);
          if (reelRow && reelRow.status !== 'done') {
            errors.push(`reel status='${reelRow.status}' (expected 'done')`);
          }
        } catch (e: any) {
          errors.push(`reel db lookup: ${e?.message}`);
        }
      } else {
        errors.push('handler did not return reelId');
      }

      // Sanity-check script populated
      const scenes = out.body?.script?.scenes ?? [];
      const analysis = out.body?.analysis ?? null;
      if (scenes.length === 0) errors.push('script.scenes vazio');
      if (!analysis) errors.push('analysis vazio');

      return res.status(200).json({
        ok: errors.length === 0 && out.status === 200,
        flow,
        durationMs: Date.now() - t0,
        statusCode: out.status,
        reelId: reelId ?? null,
        scenesReturned: scenes.length,
        scenesPreview: scenes.slice(0, 3).map((s: any) => ({
          n: s?.n, papel: s?.papel, tempo: s?.tempo,
          copyHead: (s?.copy ?? '').slice(0, 80),
        })),
        analysisResumo: analysis?.resumo?.slice(0, 200) ?? null,
        sourceMeta: out.body?.sourceMeta ?? null,
        reelRow,
        log,
        errors,
        rawPayload: errors.length > 0 ? out.body : undefined,
      });
    }

    if (flow === 'gen-radar-brief') {
      step('start gen-radar-brief — generate-radar-brief real handler');
      const niche = body.niche as string | undefined;

      const mod: any = await import('./generate-radar-brief.js');
      step('imported generate-radar-brief');

      const out = await invokeRealHandler(
        mod,
        { clientId, niche },
        cronSecret,
        GABRIEL_USER_ID,
      );
      step(`generate-radar-brief returned status=${out.status}`);

      if (out.status >= 400) {
        errors.push(`generate-radar-brief ${out.status}: ${JSON.stringify(out.body).slice(0, 600)}`);
      }

      const pool = getPool();
      let briefRow: any = null;
      const briefId: string | undefined = out.body?.briefId;
      if (briefId) {
        try {
          const r = await pool.query(
            `SELECT id, status, niche,
                    jsonb_array_length(narratives) AS narratives_count,
                    jsonb_array_length(hot_topics) AS hot_topics_count,
                    jsonb_array_length(carousel_ideas) AS ideas_count,
                    jsonb_array_length(cross_pollination) AS cross_count,
                    sources_summary, error_message, duration_ms, cost_usd
               FROM viral_radar_briefs WHERE id = $1`,
            [briefId],
          );
          briefRow = r.rows[0] ?? null;
          step(`brief row: ${briefRow ? `status=${briefRow.status}` : 'MISSING'}`);
          if (briefRow && briefRow.status !== 'done') {
            errors.push(`brief status='${briefRow.status}' (expected 'done')`);
          }
        } catch (e: any) {
          errors.push(`brief db lookup: ${e?.message}`);
        }
      } else {
        errors.push('handler did not return briefId');
      }

      const brief = out.body?.brief ?? null;
      const narratives = brief?.narratives ?? [];
      const hotTopics = brief?.hot_topics ?? [];
      if (narratives.length === 0 && out.status === 200) errors.push('narratives vazio');

      return res.status(200).json({
        ok: errors.length === 0 && out.status === 200,
        flow,
        durationMs: Date.now() - t0,
        statusCode: out.status,
        briefId: briefId ?? null,
        narrativesCount: narratives.length,
        hotTopicsCount: hotTopics.length,
        carouselIdeasCount: brief?.carousel_ideas?.length ?? 0,
        crossPollinationCount: brief?.cross_pollination?.length ?? 0,
        narrativesPreview: narratives.slice(0, 3).map((n: any) => ({
          title: n?.title, why: (n?.why ?? '').slice(0, 100),
        })),
        sourcesSummary: brief?.sources_summary ?? null,
        briefRow,
        log,
        errors,
        rawPayload: errors.length > 0 ? out.body : undefined,
      });
    }

    if (flow === 'kai-chat') {
      step('start kai-chat — kai-simple-chat real handler');
      const message = (body.message as string) ?? 'Quais carrosseis posso fazer essa semana?';
      const stream = body.stream === true; // default false (non-SSE = simpler)
      const useTools = body.useTools !== false; // default true

      const mod: any = await import('./kai-simple-chat.js');
      step('imported kai-simple-chat');

      // Use internalServiceAuth path — handler accepts SUPABASE_SERVICE_ROLE_KEY.
      const internalToken = process.env.INTERNAL_SERVICE_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!internalToken) {
        errors.push('INTERNAL_SERVICE_TOKEN / SUPABASE_SERVICE_ROLE_KEY missing — cannot call kai-simple-chat');
        return res.status(500).json({ ok: false, flow, errors, log });
      }

      // kai-simple-chat doesn't honor verifyAuth bypass — it has own internalServiceAuth
      // path. Build mockReq with that auth.
      const mockReq: any = {
        method: 'POST',
        url: '/api/kai-simple-chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${internalToken}`,
        },
        body: {
          message,
          clientId,
          internalServiceAuth: true,
          userId: GABRIEL_USER_ID,
          stream,
          useTools,
        },
        query: {},
      };
      const sseChunks: string[] = [];
      let captured: any = null;
      let statusCode = 200;
      const mockRes: any = {
        statusCode: 200,
        writableEnded: false,
        setHeader: () => mockRes,
        getHeader: () => undefined,
        flushHeaders: () => {},
        write: (chunk: any) => {
          sseChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
          return true;
        },
        status(c: number) { this.statusCode = c; statusCode = c; return this; },
        json(p: any) { captured = p; this.writableEnded = true; return this; },
        send(p: any) { captured = p; this.writableEnded = true; return this; },
        end() { this.writableEnded = true; return this; },
        on: () => mockRes,
      };

      step('calling kai-simple-chat...');
      try {
        await mod.default(mockReq, mockRes);
        step(`kai-simple-chat returned status=${statusCode}, ssechunks=${sseChunks.length}`);
      } catch (e: any) {
        errors.push(`kai-simple-chat threw: ${e?.message}`);
      }

      const sseJoined = sseChunks.join('');
      const toolEvents: any[] = [];
      const actionCards: any[] = [];
      const contentDeltas: string[] = [];
      // Parse SSE: lines beginning with "data:" carrying JSON.
      // KAI emitter format: { choices: [{ delta: { content?, tool_running?, action_card?, image?, error? } }] }
      for (const line of sseJoined.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          const delta = j?.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) contentDeltas.push(delta.content);
          if (delta.tool_running) toolEvents.push({ kind: 'tool_running', ...delta.tool_running });
          if (delta.action_card) actionCards.push(delta.action_card);
          if (delta.error) toolEvents.push({ kind: 'error', error: delta.error });
        } catch {}
      }

      return res.status(200).json({
        ok: errors.length === 0 && statusCode === 200,
        flow,
        durationMs: Date.now() - t0,
        statusCode,
        sseChunkCount: sseChunks.length,
        contentLength: contentDeltas.join('').length,
        contentHead: contentDeltas.join('').slice(0, 300),
        toolEvents: toolEvents.slice(0, 10),
        actionCardsCount: actionCards.length,
        actionCardsPreview: actionCards.slice(0, 3).map((c: any) => ({
          id: c?.id, type: c?.type, status: c?.status,
          planning_item_id: c?.planning_item_id,
          briefing: c?.data?.briefing?.slice(0, 80),
        })),
        capturedJson: captured,
        log,
        errors,
      });
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

    if (flow === 'test-automation') {
      // Fluxo end-to-end planning_automations:
      //   1. Cria planning_automation tipo schedule daily/now (auto_generate=true)
      //   2. Dispara process-automations apontando pra ela (manualmente)
      //   3. Verifica planning_item criado pela automation
      //   4. Cleanup (default true) — apaga item, runs e a automation
      //
      // Body opts:
      //   { cleanup?: false, statusAfterGeneration?: 'idea'|'draft'|'approved' }
      step('start test-automation');
      const pool = getPool();

      // 1. Resolve coluna padrão do workspace Kaleidos
      const col = await queryOne<{ id: string }>(
        `SELECT id FROM kanban_columns
           WHERE workspace_id = $1
           ORDER BY (is_default IS TRUE) DESC, position ASC
           LIMIT 1`,
        [KALEIDOS_WORKSPACE],
      );
      if (!col?.id) {
        errors.push('Sem kanban_columns no workspace Kaleidos');
        return res.status(200).json({
          ok: false, flow, errors, log, durationMs: Date.now() - t0,
        });
      }
      step(`column resolved: ${col.id}`);

      // 2. Cria automação de teste — schedule daily 00:00 garante shouldTrigger=true
      //    em qualquer chamada manual (e o handler já força shouldTrigger=true via
      //    automationId). content_type=tweet, auto_publish=false.
      const automationName = `[TEST] dev-test-flow ${new Date().toISOString().slice(0, 16)}`;
      const insertRes = await pool.query(
        `INSERT INTO planning_automations
           (workspace_id, client_id, name, is_active,
            trigger_type, trigger_config,
            target_column_id, platform, content_type,
            auto_generate_content, prompt_template,
            auto_publish, status_after_generation,
            auto_generate_image,
            created_by)
         VALUES ($1, $2, $3, TRUE,
                 'schedule', $4::jsonb,
                 $5, 'twitter', 'tweet',
                 TRUE, $6,
                 FALSE, $7,
                 FALSE,
                 $8)
         RETURNING id, name, status_after_generation, content_type, trigger_type`,
        [
          KALEIDOS_WORKSPACE,
          MADUREIRA_CLIENT,
          automationName,
          JSON.stringify({ type: 'daily', time: '00:00' }),
          col.id,
          'Tweet de teste em PT-BR, 1 frase curta sobre marketing/IA. Sem hashtag.',
          (body.statusAfterGeneration as string) ?? 'idea',
          GABRIEL_USER_ID,
        ],
      );
      const automation = insertRes.rows[0];
      step(`automation created: ${automation.id} status_after=${automation.status_after_generation}`);

      // 3. Dispara process-automations apontando pra essa automation
      let processStatusCode = 0;
      let processPayload: any = null;
      try {
        const mod: any = await import('./process-automations.js');
        const mockReq: any = {
          method: 'POST',
          headers: {
            authorization: authHeader,
            'content-type': 'application/json',
          },
          body: { automationId: automation.id },
          query: {},
        };
        const mockRes: any = {
          statusCode: 200,
          headersSent: false,
          setHeader: () => mockRes,
          status(c: number) { this.statusCode = c; processStatusCode = c; return this; },
          json(p: any) { processPayload = p; this.headersSent = true; return this; },
          end() { this.headersSent = true; return this; },
        };
        await mod.default(mockReq, mockRes);
        step(`process-automations status=${processStatusCode} triggered=${processPayload?.triggered}`);
      } catch (e: any) {
        errors.push(`process-automations: ${e?.message}`);
      }

      // 4. Verifica planning_item criado pela automation (filtra por metadata.automation_id)
      const itemRow = await queryOne<{
        id: string;
        title: string;
        content: string | null;
        content_type: string;
        status: string;
        column_id: string;
      }>(
        `SELECT id, title, content, content_type, status, column_id
           FROM planning_items
          WHERE workspace_id = $1
            AND metadata::text LIKE $2
          ORDER BY created_at DESC
          LIMIT 1`,
        [KALEIDOS_WORKSPACE, `%${automation.id}%`],
      );
      step(`planning_item created: ${itemRow ? itemRow.id : 'NOT FOUND'}`);
      if (!itemRow) errors.push('planning_item não foi criado pela automation');

      // 5. Cleanup opcional (default true)
      const cleanup = body.cleanup !== false;
      if (cleanup && itemRow?.id) {
        await pool.query(`DELETE FROM planning_items WHERE id = $1`, [itemRow.id]).catch(() => null);
        step(`planning_item ${itemRow.id} removed`);
      }
      if (cleanup) {
        await pool.query(`DELETE FROM planning_automation_runs WHERE automation_id = $1`, [automation.id]).catch(() => null);
        await pool.query(`DELETE FROM planning_automations WHERE id = $1`, [automation.id]).catch(() => null);
        step(`automation ${automation.id} removed`);
      }

      return res.status(200).json({
        ok: errors.length === 0 && !!itemRow,
        flow,
        durationMs: Date.now() - t0,
        automationId: automation.id,
        automationName,
        statusAfterGeneration: automation.status_after_generation,
        processStatusCode,
        processTriggered: processPayload?.triggered ?? 0,
        processResults: processPayload?.results ?? [],
        planningItem: itemRow ? {
          id: itemRow.id,
          title: itemRow.title,
          status: itemRow.status,
          content_type: itemRow.content_type,
          contentLen: itemRow.content?.length ?? 0,
          contentHead: (itemRow.content ?? '').slice(0, 120),
        } : null,
        cleanup,
        log,
        errors,
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
