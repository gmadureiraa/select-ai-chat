// Migrated from supabase/functions/send-invite-email/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { query, queryOne } from '../_lib/db.js';
import { assertWorkspaceAccess } from '../_lib/access.js';

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  viewer: 'Visualizador',
};

interface InviteEmailBody {
  inviteId?: string;
}

interface InviteEmailRow {
  id: string;
  email: string;
  role: string;
  expires_at: string | null;
  workspace_id: string;
  workspace_name: string;
  inviter_name: string | null;
  inviter_email: string | null;
}

function escapeHtml(value: string | null | undefined): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Internal error');
}

function errorStatus(error: unknown): number {
  if (!error || typeof error !== 'object') return 500;
  const status = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : 500;
}

function formatExpirationDate(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function resolveBaseUrl(req: VercelRequest): string {
  const rawOrigin = (req.headers.origin as string | undefined) || (req.headers.referer as string | undefined);
  if (!rawOrigin) return 'https://kai.kaleidos.com.br';
  try {
    const origin = new URL(rawOrigin).origin;
    const { protocol, hostname } = new URL(origin);
    const vercelHosts = new Set(
      [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.NEXT_PUBLIC_VERCEL_URL]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.replace(/^https?:\/\//, '').replace(/\/$/, '')),
    );
    const isAllowed =
      protocol === 'https:' &&
      (hostname === 'kai.kaleidos.com.br' ||
        hostname.endsWith('.kaleidos.com.br') ||
        hostname === 'kai-2-topaz.vercel.app' ||
        vercelHosts.has(hostname));
    const isLocalDev =
      protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
    return isAllowed || isLocalDev ? origin : 'https://kai.kaleidos.com.br';
  } catch {
    return 'https://kai.kaleidos.com.br';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Defesa contra spam de email: requer auth real (qualquer user logado).
  // O fluxo de invite vem do front após o usuário criar o invite no DB.
  const user = await tryAuth(req);
  if (!user) return jsonError(res, 401, 'Authentication required');

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return jsonError(res, 500, 'Email service not configured');

  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {})) as InviteEmailBody;
    const { inviteId } = body;
    if (!inviteId) return jsonError(res, 400, 'inviteId is required');

    const invite = await queryOne<InviteEmailRow>(
      `SELECT wi.id,
              wi.email,
              wi.role,
              wi.expires_at,
              wi.workspace_id,
              w.name AS workspace_name,
              p.full_name AS inviter_name,
              p.email AS inviter_email
         FROM workspace_invites wi
         JOIN workspaces w ON w.id = wi.workspace_id
         LEFT JOIN profiles p ON p.id = wi.invited_by
        WHERE wi.id = $1
        LIMIT 1`,
      [inviteId],
    );
    if (!invite) return jsonError(res, 404, 'Invite not found');
    await assertWorkspaceAccess(user.id, invite.workspace_id, ['owner', 'admin']);

    const clientRows = await query<{ name: string }>(
      `SELECT c.name
         FROM workspace_invite_clients wic
         JOIN clients c ON c.id = wic.client_id
        WHERE wic.invite_id = $1
          AND c.workspace_id = $2
        ORDER BY c.name ASC`,
      [inviteId, invite.workspace_id],
    ).catch(() => []);

    const email = invite.email;
    const workspaceName = invite.workspace_name;
    const inviterName = invite.inviter_name || invite.inviter_email || 'Um administrador';
    const role = invite.role;
    const expiresAt = invite.expires_at;
    const clientNames = clientRows.map((client) => client.name);
    const roleLabel = roleLabels[role] || role;
    const baseUrl = resolveBaseUrl(req);
    // 2026-05-18: URL CORRETA usa /signup?invite=<inviteId> (não /login?invite=1 com literal "1").
    // Quando user loga via Google nesse signup, trigger sync_neon_auth_to_auth_users aceita invite
    // por email match e cria workspace_members automaticamente.
    const inviteUrl = `${baseUrl}/signup?invite=${encodeURIComponent(inviteId)}`;
    const createAccountUrl = `${baseUrl}/signup`;
    let clientAccessHtml = '';
    if (clientNames && Array.isArray(clientNames) && clientNames.length > 0) {
      clientAccessHtml = `<div style="background-color:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;"><p style="margin:0 0 8px 0;font-weight:600;color:#374151;">Acesso aos clientes:</p><ul style="margin:0;padding-left:20px;color:#6b7280;">${clientNames.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`;
    }
    const formattedExpiration = formatExpirationDate(expiresAt);
    const expirationHtml = formattedExpiration
      ? `<div style="margin-top:24px;padding:12px;background-color:#fef3c7;border-radius:8px;text-align:center;"><p style="margin:0;color:#92400e;font-size:12px;">Este convite expira em <strong>${formattedExpiration}</strong></p></div>`
      : '';
    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
<div style="background-color:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden;">
<div style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);padding:32px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">kAI</h1>
<p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Assistente de Marketing com IA</p></div>
<div style="padding:32px;"><h2 style="margin:0 0 16px 0;color:#111827;font-size:20px;font-weight:600;">Você foi convidado!</h2>
    <p style="margin:0 0 16px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá! <strong>${escapeHtml(inviterName)}</strong> convidou você para fazer parte do workspace <strong>"${escapeHtml(workspaceName)}"</strong> como <strong>${escapeHtml(roleLabel)}</strong>.</p>
${clientAccessHtml}
<p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.6;">Clique no botão abaixo para acessar:</p>
    <div style="text-align:center;margin:32px 0;"><a href="${escapeHtml(inviteUrl)}" target="_blank" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);">Acessar Workspace</a></div>
    <p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;text-align:center;">Não tem conta? <a href="${escapeHtml(createAccountUrl)}" style="color:#7c3aed;text-decoration:underline;font-weight:500;">Crie uma gratuitamente</a></p>
${expirationHtml}</div>
<div style="background-color:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#9ca3af;font-size:12px;">Se você não esperava este convite, pode ignorar este email com segurança.</p>
<p style="margin:8px 0 0 0;color:#d1d5db;font-size:11px;">kAI - Kaleidos</p></div></div></div></body></html>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'kAI <noreply@news.kaleidos.com.br>',
        to: [email],
        subject: `${inviterName} te convidou para ${workspaceName}`,
        html: emailHtml,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Resend API error: ${t}`);
    }
    const data = await r.json();
    console.log('Invite email sent successfully:', data);
    res.status(200).json({ success: true, ...data });
  } catch (err) {
    console.error('[send-invite-email] error:', err);
    return jsonError(res, errorStatus(err), errorMessage(err));
  }
}
