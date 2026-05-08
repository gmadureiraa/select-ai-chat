// Postiz OAuth callback handler — substitui late-oauth-callback.
//
// Fluxo:
//   1. Recebe `?attemptId=...` (e opcionalmente `?integrationId=` se Postiz redirecionou direto).
//   2. Lê `oauth_connection_attempts` pra recuperar clientId/platform/pre_existing_ids.
//   3. Faz GET /integrations no Postiz e identifica a integration NOVA (não estava no snapshot).
//   4. Salva em `client_social_credentials` com `metadata.postiz_integration_id`.
//   5. Renderiza HTML que postMessage('postiz_oauth_success' | 'postiz_oauth_error') ao opener.
//
// Compatibilidade: postMessage envia AMBOS `postiz_oauth_*` E `late_oauth_*` events durante
// a migração — o front antigo escuta `late_oauth_*` e ainda vai funcionar.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';
import {
  getPostizConfig,
  listIntegrations,
  POSTIZ_PLATFORM_MAP,
  type PostizIntegration,
} from '../_lib/integrations/postiz.js';

const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

function htmlResponse(res: VercelResponse, status: number, html: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(html);
}

function generateSuccessPage(displayName: string, platform: string, clientId: string, accountName: string): string {
  const safeAccountName = accountName.replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Conectado</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);}
.message{background:white;padding:40px;border-radius:16px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2);}
.success{color:#22c55e;font-size:48px;}
h2{color:#1a1a2e;margin:16px 0 8px;}
p{color:#666;margin:0;}
button{margin-top:20px;padding:12px 24px;background:#22c55e;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;}
.hidden{display:none;}
</style></head>
<body>
<div class="message">
  <div class="success">✓</div>
  <h2>Conectado!</h2>
  <p>${displayName} foi conectado com sucesso.</p>
  <button id="closeBtn" class="hidden" onclick="window.close()">Fechar esta janela</button>
</div>
<script>
if (window.opener && !window.opener.closed) {
  try {
    window.opener.postMessage({ type:'postiz_oauth_success', platform:'${platform}', clientId:'${clientId}', accountName:'${safeAccountName}', provider:'postiz' }, '*');
    // Compat: front antigo escuta late_oauth_*.
    window.opener.postMessage({ type:'late_oauth_success', platform:'${platform}', clientId:'${clientId}', accountName:'${safeAccountName}', provider:'postiz' }, '*');
  } catch(e){}
}
let attempts = 0;
const tryClose = () => {
  attempts++;
  try { window.close(); } catch(e){}
  if (attempts >= 3) { document.getElementById('closeBtn').classList.remove('hidden'); }
  else { setTimeout(tryClose, 300); }
};
setTimeout(tryClose, 100);
</script>
</body></html>`;
}

function generateErrorPage(message: string, platform: string | null, clientId: string | null): string {
  const escapedMessage = message.replace(/'/g, "\\'").replace(/"/g, '\\"');
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Erro na Conexão</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);}
.message{background:white;padding:40px;border-radius:16px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2);max-width:400px;}
.error{color:#ef4444;font-size:48px;}
h2{color:#1a1a2e;margin:16px 0 8px;}
p{color:#666;margin:0;line-height:1.5;}
button{margin-top:20px;padding:12px 24px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;}
.hidden{display:none;}
</style></head>
<body>
<div class="message">
  <div class="error">✕</div>
  <h2>Erro na Conexão</h2>
  <p>${escapedMessage}</p>
  <button id="closeBtn" class="hidden" onclick="window.close()">Fechar esta janela</button>
</div>
<script>
if (window.opener && !window.opener.closed) {
  try {
    window.opener.postMessage({ type:'postiz_oauth_error', error:'${escapedMessage}', platform:${platform ? `'${platform}'` : 'null'}, clientId:${clientId ? `'${clientId}'` : 'null'}, provider:'postiz' }, '*');
    window.opener.postMessage({ type:'late_oauth_error', error:'${escapedMessage}', platform:${platform ? `'${platform}'` : 'null'}, clientId:${clientId ? `'${clientId}'` : 'null'}, provider:'postiz' }, '*');
  } catch(e){}
}
let attempts = 0;
const tryClose = () => {
  attempts++;
  try { window.close(); } catch(e){}
  if (attempts >= 3) { document.getElementById('closeBtn').classList.remove('hidden'); }
  else { setTimeout(tryClose, 300); }
};
setTimeout(tryClose, 100);
</script>
</body></html>`;
}

function generateWaitingPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><title>Conectando...</title><meta charset="UTF-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}
.card{background:white;padding:40px;border-radius:16px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2);max-width:400px;}
.spinner{width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;}
@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
h2{color:#1a1a2e;margin:0 0 8px;font-size:18px;}
p{color:#666;margin:0;font-size:14px;}
button{margin-top:20px;padding:12px 24px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;}
.hidden{display:none;}
</style></head>
<body>
<div class="card">
  <div class="spinner"></div>
  <h2>Conectando...</h2>
  <p>Adicione a conta no painel do Postiz e volte aqui.</p>
  <button id="closeBtn" class="hidden" onclick="window.close()">Fechar esta janela</button>
</div>
<script>
setTimeout(() => { document.getElementById('closeBtn').classList.remove('hidden'); }, 30000);
setTimeout(() => { window.close(); }, 5 * 60 * 1000);
</script>
</body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  let cfg;
  try {
    cfg = getPostizConfig();
  } catch (e: any) {
    return res.status(503).json({ error: 'Postiz integration not configured', missing_env: ['POSTIZ_API_KEY'] });
  }

  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    const attemptId = url.searchParams.get('attemptId');
    const explicitIntegrationId = url.searchParams.get('integrationId');

    if (!attemptId) {
      return htmlResponse(res, 200, generateErrorPage('attemptId ausente', null, null));
    }

    const attempt = await queryOne<any>(
      `SELECT * FROM oauth_connection_attempts WHERE id = $1 LIMIT 1`,
      [attemptId],
    );
    if (!attempt) {
      return htmlResponse(res, 200, generateErrorPage('Sessão não encontrada', null, null));
    }
    if (new Date(attempt.expires_at) < new Date()) {
      return htmlResponse(res, 200, generateErrorPage('Sessão expirada. Tente conectar novamente.', null, null));
    }
    if (attempt.used_at) {
      return htmlResponse(res, 200, generateErrorPage('Esta sessão já foi utilizada.', null, null));
    }

    const clientId = attempt.client_id;
    const platform = attempt.platform;

    // pre_existing_ids guardado no campo profile_id (jsonb stringified) na criação.
    let preExisting: string[] = [];
    try {
      const profileField = attempt.profile_id;
      if (profileField) {
        const parsed = typeof profileField === 'string' ? JSON.parse(profileField) : profileField;
        if (parsed?.pre_existing_ids && Array.isArray(parsed.pre_existing_ids)) {
          preExisting = parsed.pre_existing_ids;
        }
      }
    } catch {}

    // Lista integrations agora — encontra a NOVA.
    const integrations = await listIntegrations(cfg);
    const expectedIdentifier = POSTIZ_PLATFORM_MAP[platform]?.identifier || platform;

    let target: PostizIntegration | undefined;
    if (explicitIntegrationId) {
      target = integrations.find((i) => i.id === explicitIntegrationId);
    }
    if (!target) {
      // Match: identifier == expected AND não estava no snapshot
      target = integrations.find(
        (i) =>
          i.identifier?.toLowerCase() === expectedIdentifier.toLowerCase() &&
          !preExisting.includes(i.id),
      );
    }
    if (!target) {
      // Fallback — pega a integration mais recente da plataforma esperada.
      target = integrations.find((i) => i.identifier?.toLowerCase() === expectedIdentifier.toLowerCase());
    }

    if (!target) {
      return htmlResponse(res, 200, generateWaitingPage());
    }

    const pool = getPool();
    await pool.query(`UPDATE oauth_connection_attempts SET used_at = NOW() WHERE id = $1`, [attemptId]);

    await pool.query(
      `INSERT INTO client_social_credentials
        (client_id, platform, account_id, account_name, is_valid, last_validated_at, validation_error, metadata, updated_at)
        VALUES ($1, $2, $3, $4, TRUE, NOW(), NULL, $5::jsonb, NOW())
       ON CONFLICT (client_id, platform) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        account_name = EXCLUDED.account_name,
        is_valid = TRUE,
        last_validated_at = NOW(),
        validation_error = NULL,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()`,
      [
        clientId,
        platform,
        target.id,
        target.name || target.profile || platform,
        JSON.stringify({
          provider: 'postiz',
          postiz_integration_id: target.id,
          postiz_identifier: target.identifier,
          username: target.profile,
          display_name: target.name,
          profile_picture: target.picture,
          connected_at: new Date().toISOString(),
        }),
      ],
    );

    const displayName = PLATFORM_NAMES[platform] || platform;
    const accountName = target.name || (target.profile ? `@${target.profile}` : displayName);

    return htmlResponse(res, 200, generateSuccessPage(displayName, platform, clientId, accountName));
  } catch (err: any) {
    console.error('Error in postiz-oauth-callback:', err);
    return htmlResponse(res, 200, generateErrorPage(err?.message || 'Erro inesperado', null, null));
  }
}
