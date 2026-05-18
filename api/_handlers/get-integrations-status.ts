// Read-only integration health map for Settings -> Integrations.
//
// Returns only boolean/configuration metadata. Never expose env values.
import { authedPost } from '../_lib/handler.js';

interface IntegrationStatus {
  configured: boolean;
  detail?: string;
}

function envSet(name: string): boolean {
  return !!process.env[name]?.replace(/\\n/g, '').trim();
}

function anyEnv(names: string[], configuredDetail: string, missingDetail: string): IntegrationStatus {
  return names.some(envSet)
    ? { configured: true, detail: configuredDetail }
    : { configured: false, detail: missingDetail };
}

export default authedPost(async () => {
  const lateCore = envSet('LATE_API_KEY');
  const lateWebhook = envSet('LATE_WEBHOOK_SECRET');

  return {
    gemini: anyEnv(
      ['GOOGLE_AI_STUDIO_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
      'Provider Gemini configurado',
      'Configure GOOGLE_AI_STUDIO_API_KEY ou GEMINI_API_KEY',
    ),
    openai: anyEnv(
      ['OPENAI_API_KEY'],
      'Provider OpenAI configurado',
      'OPENAI_API_KEY não configurada',
    ),
    anthropic: anyEnv(
      ['ANTHROPIC_API_KEY'],
      'Provider Anthropic configurado',
      'ANTHROPIC_API_KEY não configurada',
    ),
    apify: anyEnv(
      [
        'APIFY_API_KEY',
        'APIFY_API_TOKEN',
        'APIFY_API_KEY_INSTAGRAM',
        'APIFY_API_KEY_TIKTOK',
        'APIFY_API_KEY_TWITTER',
        'APIFY_API_KEY_THREADS',
        'APIFY_API_KEY_LINKEDIN',
      ],
      'Apify configurado',
      'Configure APIFY_API_KEY/APIFY_API_TOKEN ou chaves por plataforma',
    ),
    late: {
      configured: lateCore,
      detail: lateCore
        ? lateWebhook
          ? 'Late API e webhook configurados'
          : 'Late API configurada; LATE_WEBHOOK_SECRET opcional/pendente'
        : 'LATE_API_KEY não configurada',
    },
    firecrawl: anyEnv(
      ['FIRECRAWL_API_KEY'],
      'Firecrawl configurado',
      'FIRECRAWL_API_KEY não configurada',
    ),
    pexels: anyEnv(
      ['PEXELS_API_KEY'],
      'Pexels configurado',
      'PEXELS_API_KEY não configurada',
    ),
  } satisfies Record<string, IntegrationStatus>;
});
