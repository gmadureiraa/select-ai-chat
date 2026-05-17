// Migrated from supabase/functions/unified-content-api/index.ts
// Pipeline: Writer → Validate → Repair → Review (multi-agent quality flow)
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { callLLM, isLLMConfigured, type LLMMessage } from '../_lib/llm.js';
import {
  parseOutput,
  validateContent,
  buildRepairPrompt,
  needsRepair,
  getValidationSummary,
} from '../_lib/shared/content-validator.js';
import {
  getFormatSchema,
  buildFormatContract,
} from '../_lib/shared/format-schemas.js';
import {
  getClientAvoidList,
  getStructuredVoice,
  normalizeFormatKey,
} from '../_lib/shared/knowledge-loader.js';
import { buildReviewerChecklist } from '../_lib/shared/quality-rules.js';
import {
  buildWriterSystemPrompt,
  getTemperatureForFormat,
} from '../_lib/shared/prompt-builder.js';

interface ContentRequestOptions {
  skip_review?: boolean;
  strict_validation?: boolean;
  max_repair_attempts?: number;
  stream?: boolean;
  include_metadata?: boolean;
}

export default authedPost(async ({ user, body }) => {
  const startTime = Date.now();
  const stepsCompleted: string[] = [];

  const {
    client_id,
    format,
    brief,
    workspace_id,
    options = {} as ContentRequestOptions,
  } = body || {};

  if (!client_id || !format || !brief) {
    throw new Error('client_id, format e brief são obrigatórios');
  }
  // P0 fix audit 2026-05-16: aceitava client_id arbitrário sem checar
  // ownership. Qualquer user logado dispara gen pra client de outro
  // workspace (consome tokens do dono real + persiste output cross-tenant).
  await assertClientAccess(user.id, client_id);

  const {
    skip_review = false,
    strict_validation = true,
    max_repair_attempts = 1,
  } = options as ContentRequestOptions;

  if (!isLLMConfigured()) {
    throw new Error(
      'Nenhuma chave de IA configurada. Configure GOOGLE_AI_STUDIO_API_KEY ou OPENAI_API_KEY.'
    );
  }

  // Verify the user has access to this client
  const clientRow = await queryOne<{ workspace_id: string; created_by: string | null; user_id: string | null }>(
    `SELECT workspace_id, created_by, user_id FROM clients WHERE id = $1 LIMIT 1`,
    [client_id]
  );
  if (!clientRow) {
    throw new Error('Client not found');
  }
  const member = await queryOne<{ id: string }>(
    `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [clientRow.workspace_id, user.id]
  );
  if (!member) {
    throw new Error("Forbidden - You don't have access to this client");
  }

  const resolvedUserId = user.id || clientRow.created_by || clientRow.user_id || 'system';
  const usageContext = {
    userId: resolvedUserId as string,
    edgeFunction: 'unified-content-api',
    clientId: client_id,
    metadata: { format, source: 'user' },
  };

  const normalizedFormat = normalizeFormatKey(format);
  const formatContract = buildFormatContract(normalizedFormat);
  console.log(`[unified-content-api] Starting generation for format: ${normalizedFormat}`);

  let writerTokens = 0;
  let repairTokens = 0;
  let reviewerTokens = 0;

  // STEP 1: Build prompt + context
  stepsCompleted.push('context_loaded');
  const schema = getFormatSchema(normalizedFormat);
  const clientAvoidList = await getClientAvoidList(client_id);

  const writerSystemPrompt = await buildWriterSystemPrompt({
    clientId: client_id,
    format: normalizedFormat,
    workspaceId: workspace_id,
    includeVoice: true,
    includeLibrary: true,
    includePerformers: true,
    includeGlobalKnowledge: true,
    includeSuccessPatterns: true,
    includeChecklist: false,
  });

  const sourcesUsed = {
    identity_guide:
      writerSystemPrompt.includes('DOCUMENTO MESTRE') ||
      writerSystemPrompt.includes('CONTEXTO OPERACIONAL'),
    library_items_count: (writerSystemPrompt.match(/Exemplo \d+:/g) || []).length,
    top_performers_count: (writerSystemPrompt.match(/Top \d+ \[/g) || []).length,
    format_rules: schema?.format_label || null,
    voice_profile:
      writerSystemPrompt.includes('VOZ DO CLIENTE') ||
      writerSystemPrompt.includes('USE SEMPRE'),
    global_knowledge:
      writerSystemPrompt.includes('KNOWLEDGE BASE') ||
      writerSystemPrompt.includes('BASE DE CONHECIMENTO'),
    content_guidelines: writerSystemPrompt.includes('GUIA DE CRIAÇÃO'),
  };

  // STEP 2: Writer
  stepsCompleted.push('writer_started');
  const writerMessages: LLMMessage[] = [
    { role: 'system', content: writerSystemPrompt },
    { role: 'user', content: brief },
  ];
  const dynamicTemp = getTemperatureForFormat(normalizedFormat);

  let writerResult;
  let usedProvider = 'google';
  try {
    writerResult = await callLLM(writerMessages, {
      maxTokens: 8192,
      temperature: dynamicTemp,
      usageContext: { ...usageContext, metadata: { ...usageContext.metadata, step: 'writer' } },
    });
    usedProvider = writerResult.provider;
  } catch (err: any) {
    console.error('[unified-content-api] Writer failed:', err);
    throw new Error(err?.message || 'Erro ao gerar conteúdo (LLM indisponível)');
  }
  writerTokens = writerResult.tokens;
  let currentContent = writerResult.content;
  stepsCompleted.push('writer_completed');

  // STEP 3: Validate
  stepsCompleted.push('validation_started');
  const parsed = parseOutput(currentContent, normalizedFormat);
  let validationResult = validateContent(parsed, normalizedFormat, clientAvoidList);
  console.log(`[unified-content-api] Validation: ${getValidationSummary(validationResult)}`);
  stepsCompleted.push('validation_completed');

  // STEP 4: Repair (if needed)
  let wasRepaired = false;
  if (needsRepair(validationResult) && strict_validation) {
    stepsCompleted.push('repair_started');
    for (let attempt = 1; attempt <= max_repair_attempts; attempt++) {
      const repairPrompt = buildRepairPrompt(validationResult.violations, currentContent);
      const repairMessages: LLMMessage[] = [
        {
          role: 'system',
          content: `Você é um editor preciso. Corrija APENAS os problemas listados.\n${formatContract}`,
        },
        { role: 'user', content: repairPrompt },
      ];
      try {
        const repairResult = await callLLM(repairMessages, {
          maxTokens: 4096,
          temperature: 0.3,
          usageContext: {
            ...usageContext,
            metadata: { ...usageContext.metadata, step: 'repair', attempt },
          },
        });
        repairTokens += repairResult.tokens;
        currentContent = repairResult.content;
        wasRepaired = true;
      } catch (err) {
        console.warn('[unified-content-api] Repair failed:', err);
        validationResult.warnings.push('Validação de reparo não concluída devido a falha na API');
        break;
      }
      const repairedParsed = parseOutput(currentContent, normalizedFormat);
      validationResult = validateContent(repairedParsed, normalizedFormat, clientAvoidList);
      console.log(`[unified-content-api] After repair: ${getValidationSummary(validationResult)}`);
      if (!needsRepair(validationResult)) break;
    }
    stepsCompleted.push('repair_completed');
  }

  // STEP 5: Reviewer
  let wasReviewed = false;
  if (!skip_review) {
    stepsCompleted.push('reviewer_started');
    const reviewerChecklist = buildReviewerChecklist();
    let voiceSection = '';
    try {
      voiceSection = (await getStructuredVoice(client_id)) || '';
    } catch (e) {
      console.warn('[unified-content-api] Could not load voice profile:', e);
    }

    const reviewerSystemPrompt = `# VOCÊ É UM REVISOR DE QUALIDADE

Sua tarefa é verificar o conteúdo contra o checklist abaixo.
Se encontrar problemas, corrija-os DIRETAMENTE no conteúdo.
Retorne APENAS o conteúdo corrigido, sem comentários.

${reviewerChecklist}

${formatContract}

${
  voiceSection
    ? `## VOZ DO CLIENTE (PRESERVE RIGOROSAMENTE)
${voiceSection}

REGRA CRÍTICA: Preserve rigorosamente o tom e as expressões do cliente.
NÃO "melhore" linguagem que faz parte da voz autêntica.
NÃO substitua gírias, expressões informais ou tom casual que fazem parte do voice profile.
`
    : ''
}

## REGRAS
1. NÃO adicione explicações ou notas
2. NÃO altere o que já está bom
3. Corrija apenas problemas reais do checklist
4. Mantenha o mesmo formato de entrega
5. PRESERVE a voz e personalidade do cliente — não uniformize
`;

    const reviewerMessages: LLMMessage[] = [
      { role: 'system', content: reviewerSystemPrompt },
      { role: 'user', content: `Revise este conteúdo:\n\n${currentContent}` },
    ];

    try {
      const reviewerResult = await callLLM(reviewerMessages, {
        maxTokens: 4096,
        temperature: 0.3,
        usageContext: {
          ...usageContext,
          metadata: { ...usageContext.metadata, step: 'reviewer' },
        },
      });
      reviewerTokens = reviewerResult.tokens;
      currentContent = reviewerResult.content;
      wasReviewed = true;
      stepsCompleted.push('reviewer_completed');
    } catch (err) {
      console.warn('[unified-content-api] Review failed, continuing without review:', err);
      stepsCompleted.push('reviewer_skipped');
    }
  }

  // FINAL — re-parse + validate
  const finalParsed = parseOutput(currentContent, normalizedFormat);
  const finalValidation = validateContent(finalParsed, normalizedFormat, clientAvoidList);

  const processingTime = Date.now() - startTime;
  const totalTokens = writerTokens + repairTokens + reviewerTokens;
  console.log(`[unified-content-api] Done in ${processingTime}ms, ${totalTokens} tokens`);

  // Aggregate summary log (best-effort, non-blocking)
  try {
    await getPool().query(
      `INSERT INTO ai_usage_logs (user_id, edge_function, model, input_tokens, output_tokens, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      [
        resolvedUserId,
        'unified-content-api-summary',
        'multi-agent-pipeline',
        0,
        0,
        JSON.stringify({
          format: normalizedFormat,
          processing_time_ms: processingTime,
          aggregate_tokens: totalTokens,
          steps: stepsCompleted,
          sources_used: sourcesUsed,
          validation_passed: finalValidation.valid,
          was_repaired: wasRepaired,
          client_id,
        }),
      ]
    );
  } catch (logErr) {
    console.warn('[unified-content-api] summary log failed (non-fatal):', logErr);
  }

  return {
    content: currentContent,
    parsed_fields: finalParsed,
    validation: {
      passed: finalValidation.valid,
      repaired: wasRepaired,
      reviewed: wasReviewed,
      warnings: finalValidation.warnings,
    },
    sources_used: sourcesUsed,
    tokens_used: {
      writer: writerTokens,
      repair: repairTokens,
      reviewer: reviewerTokens,
      total: totalTokens,
    },
    metadata: {
      format: normalizedFormat,
      format_label: schema?.format_label || normalizedFormat,
      processing_time_ms: processingTime,
      steps_completed: stepsCompleted,
      provider: usedProvider,
    },
  };
});
