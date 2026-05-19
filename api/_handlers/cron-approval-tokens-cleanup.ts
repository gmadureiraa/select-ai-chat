// cron-approval-tokens-cleanup — roda 1x/dia (03:00 BRT, antes do pico).
// Limpa `approval_tokens` antigos da tabela criada na migration 0043.
//
// Política:
//   - Apaga rows com expires_at < NOW() - INTERVAL '1 day'.
//     (Mantém 1 dia de histórico pós-expiry pra debug forense — replay
//      attack, suspeita de abuse pattern etc.)
//
// Sem isso a tabela cresce indefinidamente — cada delete tool call gera 1 row.
// Em volume típico (~100-500 deletes/dia) seriam ~150k rows/ano se não
// limparmos. Não quebra nada (índices estão filtered WHERE consumed_at IS NULL),
// mas vacuum/analyze custa $$.
//
// Auth: assertCronAuth (Bearer CRON_SECRET). Scheduler Vercel envia automático.
//
// Schedule: `0 3 * * *` (todo dia 03:00 UTC ≈ 00:00 BRT).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { query } from '../_lib/db.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  if (!assertCronAuth(req, res)) return;

  const startedAt = Date.now();

  try {
    // count pendentes (debug)
    const pendingBefore = await query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.approval_tokens
        WHERE expires_at < NOW() - INTERVAL '1 day'`,
    );
    const toDelete = Number(pendingBefore[0]?.c ?? 0);

    const deleted = await query<{ id: string }>(
      `DELETE FROM public.approval_tokens
        WHERE expires_at < NOW() - INTERVAL '1 day'
        RETURNING id`,
    );

    const durationMs = Date.now() - startedAt;
    console.log(
      `[cron-approval-tokens-cleanup] deleted ${deleted.length}/${toDelete} expired tokens (${durationMs}ms)`,
    );

    return res.status(200).json({
      ok: true,
      deleted: deleted.length,
      expectedToDelete: toDelete,
      durationMs,
    });
  } catch (err: any) {
    console.error('[cron-approval-tokens-cleanup] failed:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'unknown',
      durationMs: Date.now() - startedAt,
    });
  }
}
