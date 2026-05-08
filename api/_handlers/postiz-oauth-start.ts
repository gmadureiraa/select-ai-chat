// Postiz OAuth start handler — substitui late-oauth-start.
//
// IMPORTANTE: o Postiz Public API NÃO expõe um endpoint OAuth-start como o Late tinha.
// O fluxo recomendado pelos docs é o user conectar o channel direto na UI do Postiz.
// Estratégia adotada:
//   1. Cria um row `oauth_connection_attempts` pro user (mantém compat com a tabela existente).
//   2. Retorna um `authUrl` apontando pra:
//        - Self-host: `${POSTIZ_CONNECT_URL_TEMPLATE}` com placeholders {platform}, {attemptId}, {callback}
//        - Cloud:    `https://app.postiz.com/launches`
//   3. O user adiciona o channel manualmente no Postiz, volta pra `/api/postiz-oauth-callback`,
//      que faz polling de `/integrations` pra encontrar a integration nova e linka ao cliente.
//
// Tradeoff: UX é "abrir Postiz UI numa aba" em vez de popup OAuth direto. Em compensação
// não precisamos manter mapeamento de credenciais por provider.
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import {
  getPostizConfig,
  listIntegrations,
  POSTIZ_PLATFORM_MAP,
} from '../_lib/integrations/postiz.js';

const ALLOWED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads'] as const;

export default authedPost(async ({ user, body, req }) => {
  const { clientId, platform } = body;
  if (!clientId || !platform) throw new Error('Missing clientId or platform');
  if (!ALLOWED_PLATFORMS.includes(platform)) throw new Error(`Plataforma não suportada: ${platform}`);

  // valida config Postiz cedo pra falhar com 503 se ausente.
  const cfg = getPostizConfig();

  const pool = getPool();

  // Snapshot integrations ANTES do user conectar — pra detectar diff no callback.
  let preExistingIds: string[] = [];
  try {
    const integrations = await listIntegrations(cfg);
    preExistingIds = integrations.map((i) => i.id);
  } catch (e) {
    console.warn('[postiz-oauth-start] failed to snapshot integrations:', e);
  }

  // Cria attempt
  const attempt = await queryOne<any>(
    `INSERT INTO oauth_connection_attempts (client_id, platform, profile_id, created_by, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes')
     RETURNING *`,
    [clientId, platform, JSON.stringify({ pre_existing_ids: preExistingIds }), user.id],
  );

  // Build callback URL
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
  const callbackBase = process.env.POSTIZ_OAUTH_CALLBACK_BASE || `${proto}://${host}`;
  const callbackUrl = `${callbackBase}/api/postiz-oauth-callback?attemptId=${attempt.id}`;

  // Build authUrl pro Postiz UI (cloud default ou self-host template)
  let authUrl: string;
  const template = process.env.POSTIZ_CONNECT_URL_TEMPLATE;
  const platformIdentifier = POSTIZ_PLATFORM_MAP[platform]?.identifier || platform;

  if (template) {
    authUrl = template
      .replace('{platform}', encodeURIComponent(platformIdentifier))
      .replace('{attemptId}', encodeURIComponent(attempt.id))
      .replace('{callback}', encodeURIComponent(callbackUrl));
  } else {
    // Default: app.postiz.com /launches (cloud). User adiciona o channel manualmente lá.
    const u = new URL('https://app.postiz.com/launches');
    u.searchParams.set('platform', platformIdentifier);
    u.searchParams.set('redirect', callbackUrl);
    authUrl = u.toString();
  }

  return {
    authUrl,
    attemptId: attempt.id,
    provider: 'postiz',
    flow: 'manual_dashboard', // sinaliza pro front que UI do Postiz vai abrir, não popup OAuth nativo
    instructions: 'Adicione o canal no painel do Postiz e volte. Detectaremos automaticamente a conexão.',
  };
});
