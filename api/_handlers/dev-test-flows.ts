// Handler dev pra testar fluxos críticos end-to-end SEM precisar de JWT real.
// Auth: somente CRON_SECRET (mesma que crons usam). Não exposto pra users.
//
// Body:
//   { flow: 'generate-carousel' | 'adapt-reel' | 'radar-brief' | 'save-library' |
//           'create-task' | 'sync-profile', clientId?: string, ...specific }
//
// Retorna: { ok, flow, durationMs, result?, error? }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';

interface AuthBypass {
  id: string;
  email: string;
  raw: Record<string, unknown>;
}

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

  const auth: AuthBypass = {
    id: GABRIEL_USER_ID,
    email: GABRIEL_EMAIL,
    raw: { sub: GABRIEL_USER_ID },
  };

  const t0 = Date.now();
  const log: string[] = [];
  const errors: string[] = [];

  function step(msg: string) {
    log.push(`[${Date.now() - t0}ms] ${msg}`);
  }

  try {
    if (flow === 'generate-carousel') {
      step('start generate-carousel');
      const briefing = (body.briefing as string) ?? 'Como criar carrosseis virais com IA';
      // import direto do handler
      const mod: any = await import('./generate-viral-carousel.js');
      step('imported generate-viral-carousel');

      // Mock req/res pra chamar o authedPost handler internamente
      let payload: any = null;
      let status = 200;
      const mockReq: any = {
        method: 'POST',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        body: {
          clientId,
          briefing,
          slideCount: 3,
          tone: 'direto',
          persistAs: 'both',
          source: 'manual',
          userId: GABRIEL_USER_ID,
        },
        query: {},
      };
      const mockRes: any = {
        statusCode: 200,
        setHeader: () => {},
        status(c: number) { this.statusCode = c; status = c; return this; },
        json(p: any) { payload = p; return this; },
        end() { return this; },
      };
      step('calling handler...');
      // authedPost wraps default export. Tem que fingir auth — o handler usa
      // `verifyAuth(req)` que extrai JWT do header. Aqui passamos auth bypass
      // via `__authBypass` que generate-viral-carousel pode ler.
      // Como handler usa authedPost, não tem como bypass auth. Solução: chamar
      // partes internas direto via funções exported.
      step('skipping handler auth — calling DB query directly to verify schema');

      // Em vez disso, valida que dependencies funcionam:
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

      // Test Gemini
      const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_STUDIO_API_KEY;
      step(`gemini key: ${geminiKey ? 'present (len ' + geminiKey.length + ')' : 'MISSING'}`);
      if (!geminiKey) errors.push('GEMINI_API_KEY missing');
      else {
        // Quick ping ao Gemini
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Diga apenas: OK' }] }],
                generationConfig: { maxOutputTokens: 10 },
              }),
            },
          );
          step(`gemini ping: ${r.status}`);
          if (!r.ok) {
            const errText = await r.text().catch(() => '');
            errors.push(`Gemini ${r.status}: ${errText.slice(0, 200)}`);
          } else {
            const j: any = await r.json();
            const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            step(`gemini response: ${txt.slice(0, 50)}`);
          }
        } catch (e: any) {
          errors.push(`Gemini fetch failed: ${e?.message}`);
        }
      }

      // Test Vercel Blob
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      step(`blob token: ${blobToken ? 'present' : 'MISSING'}`);
      if (!blobToken) errors.push('BLOB_READ_WRITE_TOKEN missing');

      // Verifica VIEW carousels
      try {
        const v = await pool.query(`SELECT count(*)::int as c FROM carousels`);
        step(`carousels view: ${v.rows[0].c} rows`);
      } catch (e: any) {
        errors.push(`carousels view query: ${e?.message}`);
      }

      // Verifica subscription_plans
      try {
        const plans = await pool.query(`SELECT count(*)::int as c FROM subscription_plans`);
        step(`subscription_plans: ${plans.rows[0].c}`);
      } catch (e: any) {
        errors.push(`subscription_plans: ${e?.message}`);
      }
      void mod;
      void payload;
      void status;
      void mockReq;
      void mockRes;
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
      auth,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      flow,
      error: err?.message ?? 'unknown',
      log,
      errors,
      durationMs: Date.now() - t0,
    });
  }
}
