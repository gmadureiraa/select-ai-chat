// Migrated from supabase/functions/late-oauth-callback/index.ts
// GET handler — receives Late callback after OAuth flow completes.
// Defensive fallback: if LATE_API_KEY not configured, returns 503.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';

const LATE_API_BASE = 'https://getlate.dev/api';
const REQUIRED_ENV = ['LATE_API_KEY'];

interface LateAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  createdAt?: string;
}

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

function generateSuccessPage(
  displayName: string,
  platform: string,
  clientId: string,
  accountName: string
): string {
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
  try { window.opener.postMessage({ type:'late_oauth_success', platform:'${platform}', clientId:'${clientId}', accountName:'${safeAccountName}' }, '*'); } catch(e){}
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

function generateErrorPage(
  message: string,
  platform: string | null,
  clientId: string | null
): string {
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
  try { window.opener.postMessage({ type:'late_oauth_error', error:'${escapedMessage}', platform:${platform ? `'${platform}'` : 'null'}, clientId:${clientId ? `'${clientId}'` : 'null'} }, '*'); } catch(e){}
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
  <div class="spinner" id="spinner"></div>
  <h2 id="title">Conectando...</h2>
  <p id="message">Complete a autorização na janela da rede social.</p>
  <button id="closeBtn" class="hidden" onclick="window.close()">Fechar esta janela</button>
</div>
<script>
const checkParent = setInterval(() => {
  if (!window.opener || window.opener.closed) { clearInterval(checkParent); window.close(); }
}, 1000);
setTimeout(() => { document.getElementById('closeBtn').classList.remove('hidden'); }, 30000);
setTimeout(() => { document.getElementById('message').textContent = 'Demorando? Tente fechar e conectar novamente.'; }, 60000);
setTimeout(() => { window.close(); }, 5 * 60 * 1000);
</script>
</body></html>`;
}

function getErrorMessage(errorCode: string): string {
  const map: Record<string, string> = {
    account_limit_exceeded:
      'Limite de contas atingido no Late API. Para conectar mais redes sociais, considere fazer upgrade do seu plano Late.',
    access_denied:
      'Acesso negado. Você cancelou a autorização ou não concedeu as permissões necessárias.',
    invalid_request: 'Requisição inválida. Por favor, tente conectar novamente.',
    unauthorized: 'Não autorizado. Verifique suas credenciais e tente novamente.',
    rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    server_error: 'Erro no servidor. Por favor, tente novamente mais tarde.',
  };
  return map[errorCode] || errorCode;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return res.status(503).json({
      error: 'Late integration not configured',
      missing_env: missing,
      hint: 'Add the missing env vars in Vercel and redeploy',
    });
  }

  const LATE_API_KEY = process.env.LATE_API_KEY!;

  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);

    const connected = url.searchParams.get('connected');
    const profileId = url.searchParams.get('profileId');
    const username = url.searchParams.get('username');
    const error = url.searchParams.get('error');
    const errorDescription =
      url.searchParams.get('error_description') || url.searchParams.get('message');
    let attemptId = url.searchParams.get('attemptId');

    // Late API may embed errors in attemptId param
    let embeddedError: string | null = null;
    if (attemptId?.includes('?')) {
      const [cleanAttemptId, queryPart] = attemptId.split('?');
      attemptId = cleanAttemptId;
      const embeddedParams = new URLSearchParams(queryPart);
      embeddedError = embeddedParams.get('error');
    }

    const finalError = error || embeddedError;

    if (finalError) {
      const errorMessage = getErrorMessage(finalError);
      return htmlResponse(res, 200, generateErrorPage(errorDescription || errorMessage, null, null));
    }

    let clientId: string | null = null;
    let platform: string | null = null;
    let attemptProfileId: string | null = null;

    // Strategy 1: Use attemptId
    if (attemptId) {
      const attempt = await queryOne<any>(
        `SELECT * FROM oauth_connection_attempts WHERE id = $1 LIMIT 1`,
        [attemptId]
      );
      if (attempt) {
        if (new Date(attempt.expires_at) < new Date()) {
          return htmlResponse(
            res,
            200,
            generateErrorPage('Sessão expirada. Tente conectar novamente.', null, null)
          );
        }
        clientId = attempt.client_id;
        platform = attempt.platform;
        attemptProfileId = attempt.profile_id;

        // If no connected/profileId in callback, lookup via Late API
        if (!connected && !profileId && attemptProfileId) {
          const accountsResponse = await fetch(
            `${LATE_API_BASE}/v1/accounts?profileId=${attemptProfileId}`,
            { headers: { Authorization: `Bearer ${LATE_API_KEY}` } }
          );

          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            const accounts: LateAccount[] = accountsData.accounts || [];

            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const newPlatformAccount =
              accounts.find((acc) => {
                const isCorrectPlatform =
                  acc.platform?.toLowerCase() === platform?.toLowerCase();
                const isRecent = !!acc.createdAt && acc.createdAt > fiveMinutesAgo;
                return isCorrectPlatform && isRecent;
              }) || accounts.find((acc) => acc.platform?.toLowerCase() === platform?.toLowerCase());

            if (newPlatformAccount) {
              const pool = getPool();
              await pool.query(
                `UPDATE oauth_connection_attempts SET used_at = NOW() WHERE id = $1`,
                [attemptId]
              );

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
                  newPlatformAccount._id,
                  newPlatformAccount.displayName ||
                    newPlatformAccount.username ||
                    platform,
                  JSON.stringify({
                    provider: 'oauth',
                    late_account_id: newPlatformAccount._id,
                    late_profile_id: attemptProfileId,
                    username: newPlatformAccount.username,
                    display_name: newPlatformAccount.displayName,
                    profile_picture: newPlatformAccount.profilePicture,
                    connected_at: new Date().toISOString(),
                  }),
                ]
              );

              const displayName = PLATFORM_NAMES[platform || ''] || platform || 'Plataforma';
              const accountName =
                newPlatformAccount.displayName ||
                (newPlatformAccount.username ? `@${newPlatformAccount.username}` : '') ||
                displayName;

              return htmlResponse(
                res,
                200,
                generateSuccessPage(displayName, platform || '', clientId || '', accountName)
              );
            } else {
              return htmlResponse(res, 200, generateWaitingPage());
            }
          }
        }

        if (attempt.used_at) {
          return htmlResponse(
            res,
            200,
            generateErrorPage('Esta sessão já foi utilizada. Tente conectar novamente.', null, null)
          );
        }

        await getPool().query(
          `UPDATE oauth_connection_attempts SET used_at = NOW() WHERE id = $1`,
          [attemptId]
        );
      }
    }

    if (!connected && !profileId) {
      return htmlResponse(res, 200, generateWaitingPage());
    }

    // Strategy 2: Fallback - find by profile_id in metadata
    if (!clientId) {
      const profiles = await query<any>(
        `SELECT client_id, metadata, account_id FROM client_social_credentials WHERE platform = 'late_profile'`
      );
      const matchingProfile = profiles.find((p: any) => {
        const metadata = (p.metadata as Record<string, unknown> | null) || {};
        return metadata.late_profile_id === profileId || p.account_id === profileId;
      });
      if (matchingProfile) clientId = matchingProfile.client_id;
    }

    if (!clientId) {
      return htmlResponse(
        res,
        200,
        generateErrorPage('Cliente não encontrado. Tente conectar novamente.', null, null)
      );
    }

    if (!platform) {
      platform = connected?.split('?')[0]?.toLowerCase() || null;
    }
    if (!platform) {
      return htmlResponse(res, 200, generateErrorPage('Plataforma não detectada', null, clientId));
    }

    // Fetch accounts from Late API
    const accountsResponse = await fetch(
      `${LATE_API_BASE}/v1/accounts?profileId=${profileId}`,
      { headers: { Authorization: `Bearer ${LATE_API_KEY}` } }
    );

    let accountData: LateAccount | null = null;
    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();
      const platformAccounts: LateAccount[] =
        accountsData.accounts?.filter(
          (acc: LateAccount) => acc.platform?.toLowerCase() === platform
        ) || [];

      if (platformAccounts.length > 0) {
        if (username) {
          accountData =
            platformAccounts.find((acc: LateAccount) => acc.username === username) ||
            platformAccounts[0];
        } else {
          accountData = platformAccounts[platformAccounts.length - 1];
        }
      }
    }

    await getPool().query(
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
        accountData?._id || username || `${platform}_${Date.now()}`,
        accountData?.displayName || accountData?.username || username || platform,
        JSON.stringify({
          provider: 'oauth',
          late_account_id: accountData?._id,
          late_profile_id: profileId,
          username: accountData?.username || username,
          display_name: accountData?.displayName,
          profile_picture: accountData?.profilePicture,
          connected_at: new Date().toISOString(),
        }),
      ]
    );

    const displayName = PLATFORM_NAMES[platform] || platform;
    let accountName = '';
    if (accountData?.displayName) {
      accountName = accountData.displayName
        .replace(/\s*undefined\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!accountName && accountData?.username) accountName = `@${accountData.username}`;
    else if (!accountName && username) accountName = `@${username}`;
    if (!accountName) accountName = displayName;

    return htmlResponse(res, 200, generateSuccessPage(displayName, platform, clientId, accountName));
  } catch (err: any) {
    console.error('Error in late-oauth-callback:', err);
    return htmlResponse(
      res,
      200,
      generateErrorPage(err?.message || 'Ocorreu um erro inesperado', null, null)
    );
  }
}
