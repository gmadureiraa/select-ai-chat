// Normalize raw errors from the publication pipeline into user-friendly PT-BR
// messages. Used by process-scheduled-posts + retry surfaces.
//
// Heurística:
//   - Network/timeout → "Sem rede"
//   - HTTP 401/403 + Metricool → "Reautorize a conexão"
//   - HTTP 429 → "Rate-limit"
//   - HTTP 4xx Metricool → mantém mensagem do provider
//   - OAuth refresh fail → "Refresh OAuth"
//   - Default: trim do .message

const NETWORK_RX = /(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network error|socket hang up)/i;
const RATE_LIMIT_RX = /(rate.?limit|429|too many requests)/i;
const OAUTH_RX = /(oauth|token.*(expired|invalid|refresh)|reautoriz)/i;
const METRICOOL_AUTH_RX = /metricool.*(401|403|unauthorized|forbidden)/i;
const METRICOOL_GENERIC_RX = /metricool/i;

export function normalizePublicationError(err: unknown): string {
  if (err == null) return 'Erro desconhecido';
  let message: string;
  if (typeof err === 'string') message = err;
  else if (err instanceof Error) message = err.message || String(err);
  else if (typeof err === 'object' && err !== null) {
    const anyErr = err as { message?: unknown; error?: unknown };
    if (typeof anyErr.message === 'string') message = anyErr.message;
    else if (typeof anyErr.error === 'string') message = anyErr.error;
    else {
      try { message = JSON.stringify(err); } catch { message = String(err); }
    }
  } else {
    message = String(err);
  }

  const trimmed = message.trim();
  if (!trimmed) return 'Erro desconhecido';

  if (NETWORK_RX.test(trimmed)) {
    return 'Falha de rede ao publicar. Tente novamente em alguns minutos.';
  }
  if (RATE_LIMIT_RX.test(trimmed)) {
    return 'Limite de requisições atingido (rate-limit). Aguarde e tente novamente.';
  }
  if (METRICOOL_AUTH_RX.test(trimmed)) {
    return 'Conexão Metricool expirada ou sem permissão. Reconecte o cliente em Settings → Integrações.';
  }
  if (OAUTH_RX.test(trimmed)) {
    return 'Token OAuth expirado. Reconecte a conta nas integrações.';
  }
  if (METRICOOL_GENERIC_RX.test(trimmed)) {
    return trimmed.length > 280 ? trimmed.slice(0, 280) + '…' : trimmed;
  }

  return trimmed.length > 280 ? trimmed.slice(0, 280) + '…' : trimmed;
}
