/**
 * Tool `createAutomation` — cria planning_automations (trigger schedule/rss/webhook
 * + prompt template) para gerar conteúdo automaticamente.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';

interface CreateAutomationArgs {
  name: string;
  trigger_type: 'schedule' | 'rss' | 'webhook';
  trigger_config?: Record<string, unknown>;
  target_column_id?: string;
  platform?: string;
  platforms?: string[];
  content_type?: string;
  prompt_template?: string;
  auto_publish?: boolean;
  auto_generate_image?: boolean;
  auto_generate_content?: boolean;
  image_prompt_template?: string;
  image_style?: 'photographic' | 'illustration' | 'minimalist' | 'vibrant';
  /** Status inicial do card quando auto_publish=false. Default 'idea'. */
  status_after_generation?: 'idea' | 'pending_approval' | 'draft' | 'approved';
  is_active?: boolean;
}

interface CreateAutomationData {
  automationId: string | null;
  name: string;
}

export const createAutomationTool: RegisteredTool<CreateAutomationArgs, CreateAutomationData> = {
  definition: {
    name: 'createAutomation',
    description:
      "Cria uma automação de conteúdo (planning_automations). Use quando o usuário pedir 'cria automação', 'monta um cron pra postar X toda manhã', 'liga RSS do feed Y pra virar tweet'. Configura trigger (schedule/rss/webhook) + prompt_template + plataforma + se publica/gera imagem auto.",
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nome curto e descritivo da automação (ex: "Tweet diário 8h", "RSS Cointelegraph → carrossel").',
        },
        trigger_type: {
          type: 'string',
          enum: ['schedule', 'rss', 'webhook'],
          description: 'Tipo de gatilho. schedule = horário (cron-like). rss = feed novo item. webhook = chamado externo.',
        },
        trigger_config: {
          type: 'object',
          description: 'Config do trigger. schedule: {type: "daily"|"weekly"|"monthly", days?: [1,3,5], time: "08:00"}. rss: {url: "https://..."}. webhook: {secret?: "..."}.',
        },
        target_column_id: {
          type: 'string',
          description: 'UUID da coluna do kanban onde o item será criado. Default: coluna padrão do workspace.',
        },
        platform: {
          type: 'string',
          description: 'Plataforma alvo (instagram, twitter, linkedin, threads, youtube, tiktok, newsletter).',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Múltiplas plataformas (cross-posting). Se preenchido, sobrescreve platform.',
        },
        content_type: {
          type: 'string',
          description: 'Tipo de conteúdo (tweet, thread, carousel, reel_script, linkedin_post, social_post, newsletter). Default: social_post.',
        },
        prompt_template: {
          type: 'string',
          description: 'Template de prompt pra gerar o conteúdo. Suporta variáveis: {{title}}, {{content}}, {{description}}, {{link}}, {{time_of_day}}, {{btc_price}}.',
        },
        auto_publish: {
          type: 'boolean',
          description: 'Se true, publica direto na plataforma (sem revisão). Default: false.',
        },
        auto_generate_image: {
          type: 'boolean',
          description: 'Se true, gera imagem automaticamente via generate-content-v2. Default: false.',
        },
        auto_generate_content: {
          type: 'boolean',
          description: 'Se true, dispara LLM pra gerar texto. Default: true.',
        },
        image_prompt_template: {
          type: 'string',
          description: 'Template de prompt pra gerar imagem (separado do texto).',
        },
        image_style: {
          type: 'string',
          enum: ['photographic', 'illustration', 'minimalist', 'vibrant'],
          description: 'Estilo visual da imagem.',
        },
        status_after_generation: {
          type: 'string',
          enum: ['idea', 'pending_approval', 'draft', 'approved'],
          description:
            "Status inicial do card criado quando auto_publish=false. 'idea' (default) cai em Ideias; 'pending_approval' entra direto no gate Aprovar; 'draft' vai pra Iniciar (em produção); 'approved' já marca como Pronto pra agendar (use só se confia 100% no template).",
        },
        is_active: {
          type: 'boolean',
          description: 'Já cria ativa? Default: true.',
        },
      },
      required: ['name', 'trigger_type'],
    },
  },

  handler: async (args, ctx) => {
    const name = String(args.name ?? '').trim();
    const triggerType = args.trigger_type;
    if (!name || !triggerType) {
      return { ok: false, error: 'name e trigger_type são obrigatórios' };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=automations-create`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({
        name,
        trigger_type: triggerType,
        trigger_config: args.trigger_config ?? {},
        target_column_id: args.target_column_id,
        platform: args.platform,
        platforms: args.platforms,
        content_type: args.content_type ?? 'social_post',
        prompt_template: args.prompt_template,
        auto_publish: args.auto_publish ?? false,
        auto_generate_image: args.auto_generate_image ?? false,
        auto_generate_content: args.auto_generate_content ?? true,
        image_prompt_template: args.image_prompt_template,
        image_style: args.image_style,
        status_after_generation: args.status_after_generation ?? 'idea',
        is_active: args.is_active ?? true,
        client_id: ctx.clientId || null,
      }),
    }).catch((err) => {
      console.error('[createAutomation] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `automations-create: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const automationId: string | null = json?.id ?? json?.automation?.id ?? null;

    const summary =
      triggerType === 'rss'
        ? `RSS: ${(args.trigger_config as any)?.url ?? '?'}`
        : triggerType === 'schedule'
          ? `Schedule: ${(args.trigger_config as any)?.type ?? '?'} ${(args.trigger_config as any)?.time ?? ''}`
          : 'Webhook';

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId: ctx.clientId,
        platform: args.platform ?? (args.platforms?.[0] ?? 'instagram'),
        format: 'automation',
        title: `Automação criada: ${name}`,
        body: `${summary}\nContent type: ${args.content_type ?? 'social_post'}\nAuto publish: ${args.auto_publish ? 'sim' : 'não'}`,
        briefing: name,
        automationId: automationId ?? undefined,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_automations',
          label: 'Ver automações',
          variant: 'primary',
          client_action: 'edit',
        },
        {
          id: 'pause_automation',
          label: 'Pausar',
          variant: 'ghost',
          tool_call: automationId
            ? { name: 'toggleAutomation', args: { automation_id: automationId, enabled: false } }
            : undefined,
        },
      ],
    };

    return { ok: true, data: { automationId, name }, card };
  },
};
