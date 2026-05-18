// Dispara refresh manual do Metricool — executa os 4 crons em sequência
// pra o botão "Atualizar" da página Performance puxar dados frescos
// sem esperar o cron diário (6h UTC).
//
// Roda em paralelo internamente via dynamic imports (sem HTTP overhead).
// Retorna sumário {ok, durations, errors[]}.

import { authedPost } from '../_lib/handler.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CronResult {
  step: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

async function runCronHandler(
  step: string,
  modulePath: string,
  req: VercelRequest,
): Promise<CronResult> {
  const start = Date.now();
  try {
    const mod = await import(modulePath);
    const handler = mod.default ?? mod.handler;
    if (typeof handler !== 'function') {
      return { step, ok: false, durationMs: Date.now() - start, error: 'handler not callable' };
    }
    // Mock res pra capturar resposta sem stream pro user
    let captured: { status?: number; body?: unknown } = {};
    const fakeRes = {
      status: (code: number) => {
        captured.status = code;
        return fakeRes;
      },
      json: (body: unknown) => {
        captured.body = body;
        return fakeRes;
      },
      setHeader: () => fakeRes,
      end: () => fakeRes,
      writableEnded: false,
      headersSent: false,
    } as unknown as VercelResponse;
    // Cron handlers checam Authorization: Bearer CRON_SECRET.
    // Injetamos esse header internamente pra desbloquear (req local).
    const internalReq = Object.assign(Object.create(Object.getPrototypeOf(req)), req, {
      headers: {
        ...req.headers,
        authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
      },
    });
    await handler(internalReq, fakeRes);
    return {
      step,
      ok: (captured.status ?? 200) < 400,
      durationMs: Date.now() - start,
      error:
        captured.status && captured.status >= 400
          ? `HTTP ${captured.status} ${JSON.stringify(captured.body).slice(0, 200)}`
          : undefined,
    };
  } catch (err) {
    return {
      step,
      ok: false,
      durationMs: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

export default authedPost(async ({ req }) => {
  const start = Date.now();

  // Ordem: backfill (busca posts novos), snapshot (métricas do dia),
  // poll (atualiza métricas dos últimos posts), fetch-published (sync
  // de planning_items publicados). Tudo em paralelo — independentes.
  const results = await Promise.all([
    runCronHandler('backfill', './cron-metricool-backfill-posts.js', req),
    runCronHandler('snapshot', './cron-metricool-snapshot.js', req),
    runCronHandler('poll', './cron-metricool-poll.js', req),
    runCronHandler('fetch_published', './cron-fetch-published-metrics.js', req),
  ]);

  const totalMs = Date.now() - start;
  const allOk = results.every((r) => r.ok);

  return {
    ok: allOk,
    total_duration_ms: totalMs,
    steps: results,
    errors: results.filter((r) => !r.ok).map((r) => `${r.step}: ${r.error}`),
  };
});
