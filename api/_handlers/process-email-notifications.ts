// Migrated from supabase/functions/process-email-notifications/index.ts
// Cron worker that drains email_notification_queue and sends via Resend HTTP API.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

const BATCH_SIZE = 50;

interface EmailQueueItem {
  id: string;
  user_id: string;
  notification_id: string;
  email: string;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  workspace_id: string;
  metadata: Record<string, unknown> | null;
}

interface Workspace {
  slug: string;
  name: string;
}

async function markAsError(id: string, error: string) {
  await getPool()
    .query(
      `UPDATE email_notification_queue SET error = $1, sent_at = NOW() WHERE id = $2`,
      [error, id],
    )
    .catch(() => null);
}

function buildAppUrl(notif: Notification, workspaceSlug: string | undefined): string {
  // KAI já saiu do Lovable. Usar APP_URL / NEXT_PUBLIC_APP_URL / VERCEL_URL ou fallback.
  const baseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://kai.kaleidos.com.br');
  if (!workspaceSlug) return baseUrl;
  let url = `${baseUrl}/${workspaceSlug}`;
  if (notif.entity_type === 'planning_item' && notif.entity_id) {
    url += `?tab=planning&openItem=${notif.entity_id}`;
  } else if (notif.entity_type === 'kanban_card' && notif.entity_id) {
    url += `?tab=kanban&openCard=${notif.entity_id}`;
  } else if (notif.entity_type === 'automation' && notif.entity_id) {
    url += `?tab=automations`;
  }
  return url;
}

function buildEmailHtml(notif: Notification, workspace: Workspace | null, appUrl: string): string {
  const typeLabels: Record<string, string> = {
    assignment: '📋 Nova atribuição',
    due_date: '📅 Lembrete de prazo',
    mention: '💬 Você foi mencionado',
    publish_reminder: '⏰ Lembrete de publicação',
    publish_failed: '❌ Falha na publicação',
    publish_success: '✅ Publicado com sucesso',
    automation_completed: '⚡ Automação executada',
  };
  const typeLabel = typeLabels[notif.type] || '🔔 Notificação';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notif.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">KAI</h1>
              ${workspace ? `<p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">${workspace.name}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px;">${typeLabel}</p>
              <h2 style="margin: 0 0 16px 0; color: white; font-size: 20px; font-weight: 600;">${notif.title}</h2>
              ${notif.message ? `<p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 16px; line-height: 1.5;">${notif.message}</p>` : ''}
              <a href="${appUrl}" style="display: inline-block; background-color: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">
                Abrir no KAI
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                Você recebeu este email porque ativou as notificações por email no KAI.
                <br><br>
                <a href="${appUrl}?tab=settings" style="color: #94a3b8; text-decoration: underline;">Gerenciar preferências</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: SOMENTE cron — drena fila global de emails.
  if (!assertCronAuth(req, res)) return;

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(200).json({
        success: true,
        message: 'Email not configured, skipping',
      });
    }

    const queueItems = await query<EmailQueueItem>(
      `SELECT * FROM email_notification_queue
       WHERE sent_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [BATCH_SIZE],
    );
    if (!queueItems || queueItems.length === 0) {
      return res.status(200).json({ success: true, processed: 0 });
    }
    console.log(`[process-email-notifications] processing ${queueItems.length}`);

    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'KAI <onboarding@resend.dev>';
    let successCount = 0;
    let errorCount = 0;

    for (const item of queueItems) {
      try {
        const notif = await queryOne<Notification>(
          `SELECT id, title, message, type, entity_type, entity_id, workspace_id, metadata
           FROM notifications
           WHERE id = $1`,
          [item.notification_id],
        );
        if (!notif) {
          await markAsError(item.id, 'Notification not found');
          errorCount++;
          continue;
        }

        const ws = await queryOne<Workspace>(
          `SELECT slug, name FROM workspaces WHERE id = $1`,
          [notif.workspace_id],
        ).catch(() => null);

        const appUrl = buildAppUrl(notif, ws?.slug);
        const subject = `[KAI] ${notif.title}`;
        const htmlContent = buildEmailHtml(notif, ws, appUrl);

        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [item.email],
            subject,
            html: htmlContent,
          }),
        });
        if (!sendRes.ok) {
          const errBody = await sendRes.text();
          console.error(`[process-email-notifications] send error to ${item.email}:`, errBody);
          await markAsError(item.id, `Resend ${sendRes.status}: ${errBody.substring(0, 200)}`);
          errorCount++;
          continue;
        }

        await getPool().query(
          `UPDATE email_notification_queue SET sent_at = NOW() WHERE id = $1`,
          [item.id],
        );
        successCount++;
      } catch (itemError: any) {
        console.error(`[process-email-notifications] item ${item.id} error:`, itemError);
        await markAsError(item.id, String(itemError?.message || itemError));
        errorCount++;
      }
    }

    console.log(
      `[process-email-notifications] done: ${successCount} sent, ${errorCount} errors`,
    );
    return res.status(200).json({
      success: true,
      processed: queueItems.length,
      sent: successCount,
      errors: errorCount,
    });
  } catch (error: any) {
    console.error('[process-email-notifications] fatal:', error);
    return jsonError(res, 500, error?.message || 'fatal');
  }
}
