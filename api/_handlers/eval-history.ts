/**
 * Endpoint admin — retorna histórico de execução do KAI Chat eval suite.
 *
 * Lê tabela `eval_runs` (migration 0044). Aceita ?limit=N (default 30) e
 * ?trigger=manual|ci|scheduled (default todos). Retorna stats agregadas
 * pra dashboard mostrar trend.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

interface EvalRunRow {
  id: string;
  created_at: string;
  model: string;
  judge_model: string | null;
  git_ref: string | null;
  trigger: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  total_duration_ms: number;
  results: unknown;
  metadata: Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method === 'POST') {
    // Insert hook — runner posta resultado via Authorization: Bearer <userToken>
    return insertRun(req, res);
  }
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');

  const auth = await tryAuth(req);
  if (!auth) return jsonError(res, 401, 'Unauthorized');

  const limitParam = Number(req.query.limit ?? 30);
  const limit = Math.max(1, Math.min(200, isNaN(limitParam) ? 30 : limitParam));
  const trigger = typeof req.query.trigger === 'string' ? req.query.trigger : null;

  try {
    let sql = `SELECT id, created_at, model, judge_model, git_ref, trigger,
                      total_cases, passed_cases, failed_cases, total_duration_ms, metadata
               FROM eval_runs`;
    const params: unknown[] = [];
    if (trigger) {
      sql += ` WHERE trigger = $1`;
      params.push(trigger);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const rows = await query<Omit<EvalRunRow, 'results'>>(sql, params);

    // Stats agregadas (todos os runs no result set)
    const totalRuns = rows.length;
    const totalCases = rows.reduce((a, r) => a + r.total_cases, 0);
    const totalPassed = rows.reduce((a, r) => a + r.passed_cases, 0);
    const avgPassRate = totalCases > 0 ? (totalPassed / totalCases) * 100 : 0;
    const latestPassRate = rows[0]
      ? (rows[0].passed_cases / Math.max(1, rows[0].total_cases)) * 100
      : 0;

    return res.status(200).json({
      runs: rows,
      stats: {
        totalRuns,
        totalCases,
        totalPassed,
        avgPassRate,
        latestPassRate,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[eval-history] erro:', err);
    return jsonError(res, 500, err instanceof Error ? err.message : 'Erro ao ler histórico');
  }
}

async function insertRun(req: VercelRequest, res: VercelResponse) {
  // Insert protegido por token compartilhado (eval roda no CI sem user JWT).
  const authToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = process.env.EVAL_INGEST_TOKEN;
  if (!expected) return jsonError(res, 503, 'EVAL_INGEST_TOKEN não configurado');
  if (authToken !== expected) return jsonError(res, 401, 'Token inválido');

  const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  const {
    model,
    judge_model,
    git_ref,
    trigger,
    total_cases,
    passed_cases,
    failed_cases,
    total_duration_ms,
    results,
    metadata,
  } = body || {};

  if (!model || typeof total_cases !== 'number') {
    return jsonError(res, 400, 'Faltam campos obrigatórios (model, total_cases)');
  }

  try {
    const inserted = await query<{ id: string }>(
      `INSERT INTO eval_runs (model, judge_model, git_ref, trigger, total_cases,
                              passed_cases, failed_cases, total_duration_ms,
                              results, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       RETURNING id`,
      [
        model,
        judge_model || null,
        git_ref || null,
        trigger || 'manual',
        total_cases,
        passed_cases || 0,
        failed_cases || 0,
        total_duration_ms || 0,
        JSON.stringify(results || []),
        JSON.stringify(metadata || {}),
      ],
    );
    return res.status(201).json({ id: inserted[0]?.id });
  } catch (err) {
    console.error('[eval-history] insert erro:', err);
    return jsonError(res, 500, err instanceof Error ? err.message : 'Erro ao salvar');
  }
}
