// Logger central — placeholder pra console com prefixo padrão.
//
// Por enquanto delega tudo pra console. Quando Sentry/PostHog estiverem
// configurados, plugar aqui (TODO abaixo) sem mexer em call-sites.
//
// Uso:
//   import { logger } from '@/lib/logger';
//   logger.error('falha ao buscar', { userId, err });
//   logger.warn('cache miss', { key });
//   logger.info('user logged in', { userId });
//   logger.debug('payload', { body }); // silencioso em prod
//
// Convenção:
//   - `msg` é descrição curta (ex: 'fetch falhou', 'token expirado').
//   - `ctx` é um objeto com IDs, error, payload truncado. Evitar PII.
//   - O prefixo `[KAI:level:context]` ajuda a grepar logs do Vercel/Console.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  // chaves comuns — não obrigatórias, só pra hint de IDE
  userId?: string | null;
  clientId?: string | null;
  workspaceId?: string | null;
  feature?: string;
  err?: unknown;
  [key: string]: unknown;
}

const IS_PROD = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

function format(level: LogLevel, msg: string, ctx?: LogContext): [string, ...unknown[]] {
  const feature = ctx?.feature || 'app';
  const prefix = `[KAI:${level}:${feature}]`;
  if (ctx && Object.keys(ctx).length > 0) {
    return [`${prefix} ${msg}`, ctx];
  }
  return [`${prefix} ${msg}`];
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  // TODO: Sentry/PostHog quando configurado.
  // - Sentry.captureException(ctx?.err ?? new Error(msg), { extra: ctx });
  // - posthog.capture(`log_${level}`, { message: msg, ...ctx });
  const parts = format(level, msg, ctx);
  switch (level) {
    case 'debug':
      // suprime debug em produção pra não poluir console
      if (!IS_PROD) console.debug(...parts);
      return;
    case 'info':
      console.info(...parts);
      return;
    case 'warn':
      console.warn(...parts);
      return;
    case 'error':
      console.error(...parts);
      return;
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};

export default logger;
