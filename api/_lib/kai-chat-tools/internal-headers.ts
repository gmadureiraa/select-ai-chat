/**
 * Helper compartilhado pra todas as tools que precisam chamar outros handlers
 * Vercel internos via HTTP.
 *
 * Problema que resolve:
 *   - Quando o KAI chat é invocado via `internalServiceAuth: true` (bot
 *     Telegram, dev-test-flows, cron), `ctx.accessToken` é o INTERNAL_SERVICE_TOKEN
 *     ou SUPABASE_SERVICE_ROLE_KEY — NÃO um JWT user.
 *   - Tools que chamavam `Authorization: Bearer ${ctx.accessToken}` recebiam 401
 *     dos handlers downstream (verifyAuth via JWKS rejeitava).
 *
 * Solução:
 *   - Quando isInternalCall=true, mandar headers `x-internal-cron-secret` +
 *     `x-internal-user-id` (pattern de auth.ts:tryInternalBypass).
 *   - Quando NÃO isInternalCall, mandar `Authorization: Bearer ${accessToken}`
 *     normal.
 *
 * Resultado: tools funcionam idênticas pro user via UI e pro bot Telegram.
 */
import type { ToolExecutionContext } from './types.js';

export function buildToolFetchHeaders(
  ctx: ToolExecutionContext,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (ctx.isInternalCall) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && ctx.userId) {
      headers['x-internal-cron-secret'] = cronSecret;
      headers['x-internal-user-id'] = ctx.userId;
    } else {
      // Fallback: passar accessToken bruto mesmo. Handlers que aceitam header
      // custom `x-internal-call: true` (generate-viral-carousel, etc) ainda
      // recebem o sinal. Sem CRON_SECRET nada disso vai funcionar, mas log
      // pra debug.
      console.warn(
        '[buildToolFetchHeaders] internal call sem CRON_SECRET — handler downstream pode rejeitar',
      );
      headers['x-internal-call'] = 'true';
      if (ctx.accessToken) headers['Authorization'] = `Bearer ${ctx.accessToken}`;
    }
  } else if (ctx.accessToken) {
    headers['Authorization'] = `Bearer ${ctx.accessToken}`;
  }
  return headers;
}
