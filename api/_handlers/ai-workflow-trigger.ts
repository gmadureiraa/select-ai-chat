// Dispara um único ai_workflow agora (manual test). Bypass do isDueToday.
// Auth: super_admin OR owner/admin do workspace.
//
// Uso: chamado pelo botão "Testar agora" no AiWorkflowCard.
// Re-aproveita a logica de run-madureira-workflows-daily, mas só pra 1 workflow,
// ignorando dia da semana / idempotência diária.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  workflow_id: z.string().uuid(),
});

export default authedPost(async ({ body, user, req }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }

  // Verifica acesso (workspace owner/admin OR super_admin)
  const access = await queryOne<{ ok: boolean; workspace_id: string; name: string; agent_id: string; schedule_cron: string }>(
    `SELECT TRUE AS ok, w.workspace_id, w.name, w.agent_id, w.schedule_cron
       FROM ai_workflows w
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = w.workspace_id
        AND wm.user_id = $2
        AND wm.role IN ('owner', 'admin')
      WHERE w.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [parsed.data.workflow_id, user.id],
  );
  if (!access?.ok) {
    throw new Error('Workflow não encontrado ou acesso negado');
  }

  // Reuse master cron secret (fire to /api/run-madureira-workflows-daily com flag de teste).
  // Como o handler atual roda baseado em cron, fazemos chamada direta interna que
  // simula um cron mas filtra por workflow_id específico via env var. Aqui fazemos
  // re-export simples: chamamos run-madureira-workflows-daily passando ?only=<id>.
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host || 'localhost:3000';
  const baseUrl = `${proto}://${host}`;
  const cronSecret = process.env.CRON_SECRET || '';

  const url = `${baseUrl}/api/run-madureira-workflows-daily?only=${encodeURIComponent(parsed.data.workflow_id)}&force=1`;

  // Fire-and-await (curto): se demorar >55s, retorna ok mas log avisa.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
        'x-vercel-cron': '1',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await r.json().catch(() => ({}));
    return {
      ok: r.ok,
      workflow_id: parsed.data.workflow_id,
      workflow_name: access.name,
      result: data,
    };
  } catch (e: any) {
    clearTimeout(timeout);
    return {
      ok: false,
      workflow_id: parsed.data.workflow_id,
      workflow_name: access.name,
      error: e?.message || 'fetch failed',
    };
  }
});
