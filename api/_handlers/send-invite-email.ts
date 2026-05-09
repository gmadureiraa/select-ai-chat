// Migrated from supabase/functions/send-invite-email/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, jsonError } from '../_lib/cors.js';

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  viewer: 'Visualizador',
};

function formatExpirationDate(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return jsonError(res, 500, 'Email service not configured');

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
    const { email, workspaceName, workspaceSlug, inviterName, role, expiresAt, clientNames } = body;
    const roleLabel = roleLabels[role] || role;
    const origin = (req.headers.origin as string) || (req.headers.referer as string);
    let baseUrl = 'https://kai-kaleidos.lovable.app';
    if (origin) {
      try { baseUrl = new URL(origin).origin; } catch {}
    }
    const inviteUrl = workspaceSlug ? `${baseUrl}/${workspaceSlug}/login?invite=1` : `${baseUrl}/login`;
    const createAccountUrl = workspaceSlug ? `${baseUrl}/${workspaceSlug}/join` : `${baseUrl}/register`;
    let clientAccessHtml = '';
    if (clientNames && Array.isArray(clientNames) && clientNames.length > 0) {
      clientAccessHtml = `<div style="background-color:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;"><p style="margin:0 0 8px 0;font-weight:600;color:#374151;">Acesso aos clientes:</p><ul style="margin:0;padding-left:20px;color:#6b7280;">${clientNames.map((n: string) => `<li>${n}</li>`).join('')}</ul></div>`;
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
<p style="margin:0 0 16px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá! <strong>${inviterName}</strong> convidou você para fazer parte do workspace <strong>"${workspaceName}"</strong> como <strong>${roleLabel}</strong>.</p>
${clientAccessHtml}
<p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.6;">Clique no botão abaixo para acessar:</p>
<div style="text-align:center;margin:32px 0;"><a href="${inviteUrl}" target="_blank" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);">Acessar Workspace</a></div>
<p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;text-align:center;">Não tem conta? <a href="${createAccountUrl}" style="color:#7c3aed;text-decoration:underline;font-weight:500;">Crie uma gratuitamente</a></p>
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
  } catch (e: any) {
    console.error('[send-invite-email] error:', e);
    return jsonError(res, 500, e?.message || 'Internal error');
  }
}
