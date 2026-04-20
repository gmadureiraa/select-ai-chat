// =====================================================
// UNIFIED CONTENT API
// Single entry point for impeccable content generation
// Pipeline: Writer → Validate → Repair → Review
// Version 2.0 - Resilient with retry + fallback
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Shared modules
import { 
  getFormatSchema, 
  buildFormatContract, 
  FormatSchema 
} from "../_shared/format-schemas.ts";

import {
  parseOutput,
  validateContent,
  buildRepairPrompt,
  needsRepair,
  getValidationSummary,
  ValidationResult,
} from "../_shared/content-validator.ts";

import {
  getClientAvoidList,
  getStructuredVoice,
  normalizeFormatKey,
} from "../_shared/knowledge-loader.ts";

import {
  buildReviewerChecklist,
} from "../_shared/quality-rules.ts";

// Centralized prompt builder
import {
  buildWriterSystemPrompt,
  getTemperatureForFormat,
} from "../_shared/prompt-builder.ts";

// Centralized LLM module with retry + fallback
import {
  callLLM,
  LLMError,
  createLLMUnavailableResponse,
  isLLMConfigured,
  LLMMessage,
} from "../_shared/llm.ts";

// =====================================================
// TYPES
// =====================================================

interface ContentRequest {
  client_id: string;
  format: string;
  brief: string;
  workspace_id?: string;
  options?: {
    skip_review?: boolean;       // default: false
    strict_validation?: boolean; // default: true
    max_repair_attempts?: number; // default: 1
    stream?: boolean;            // default: false for this API
    include_metadata?: boolean;  // default: true
  };
}

interface SourcesUsed {
  identity_guide: boolean;
  library_items_count: number;
  top_performers_count: number;
  format_rules: string | null;
  voice_profile: boolean;
  global_knowledge: boolean;
  content_guidelines: boolean;
}

interface ContentResponse {
  content: string;
  parsed_fields: Record<string, string>;
  validation: {
    passed: boolean;
    repaired: boolean;
    reviewed: boolean;
    warnings: string[];
  };
  sources_used: SourcesUsed;
  tokens_used: {
    writer: number;
    repair: number;
    reviewer: number;
    total: number;
  };
  metadata: {
    format: string;
    format_label: string;
    processing_time_ms: number;
    steps_completed: string[];
    provider?: string;
  };
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const stepsCompleted: string[] = [];

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parse request
    const body = await req.json() as ContentRequest;
    const { 
      client_id, 
      format, 
      brief, 
      workspace_id,
      options = {} 
    } = body;

    const {
      skip_review = false,
      strict_validation = true,
      max_repair_attempts = 1,
      include_metadata = true,
    } = options;

    // Validate required fields
    if (!client_id || !format || !brief) {
      return new Response(
        JSON.stringify({ error: "client_id, format e brief são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // SECURITY: Validate user access to client
    // ========================================
    let resolvedUserId: string = req.headers.get("x-user-id") || "system";
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ") && !authHeader.includes(supabaseKey)) {
      // This is a user JWT, not service role - validate access
      const userToken = authHeader.replace("Bearer ", "");
      const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: claims, error: authError } = await userSupabase.auth.getUser(userToken);
      
      if (authError || !claims?.user) {
        console.error("[UNIFIED-API] Auth validation failed:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized - Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const userId = claims.user.id;
      resolvedUserId = userId;
      
      // Check if user has access to the client's workspace
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("workspace_id")
        .eq("id", client_id)
        .single();
      
      if (clientError || !clientData) {
        console.error("[UNIFIED-API] Client not found:", client_id);
        return new Response(
          JSON.stringify({ error: "Client not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data: memberData, error: memberError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", clientData.workspace_id)
        .eq("user_id", userId)
        .single();
      
      if (memberError || !memberData) {
        console.error("[UNIFIED-API] User not member of client workspace:", userId, clientData.workspace_id);
        return new Response(
          JSON.stringify({ error: "Forbidden - You don't have access to this client" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[UNIFIED-API] User ${userId} authorized for client ${client_id}`);
    }

    // For automation/system calls, fall back to client owner so cost is attributable
    if (resolvedUserId === "system") {
      try {
        const { data: ownerRow } = await supabase
          .from("clients")
          .select("created_by, user_id")
          .eq("id", client_id)
          .single();
        if (ownerRow) {
          resolvedUserId = (ownerRow.created_by || ownerRow.user_id || "system") as string;
        }
      } catch (e) {
        console.warn("[UNIFIED-API] Could not resolve owner for system call:", e);
      }
    }

    const usageContext = {
      userId: resolvedUserId,
      edgeFunction: "unified-content-api",
      clientId: client_id,
      metadata: { format, source: req.headers.get("x-trigger-source") || "user" },
    };


    const normalizedFormat = normalizeFormatKey(format);
    const formatContract = buildFormatContract(normalizedFormat);
    console.log(`[UNIFIED-API] Starting generation for format: ${normalizedFormat}`);

    // Token tracking
    let writerTokens = 0;
    let repairTokens = 0;
    let reviewerTokens = 0;

    // =========================================================
    // STEP 1: LOAD CONTEXT + BUILD PROMPT (centralized)
    // =========================================================
    console.log("[UNIFIED-API] Step 1: Loading context...");
    stepsCompleted.push("context_loaded");

    // Get format schema for validation
    const schema = getFormatSchema(normalizedFormat);
    if (!schema && strict_validation) {
      console.warn(`[UNIFIED-API] No schema found for format: ${normalizedFormat}`);
    }

    // Get client avoid list for validation
    const clientAvoidList = await getClientAvoidList(client_id);

    // Build writer system prompt using centralized builder
    const writerSystemPrompt = await buildWriterSystemPrompt({
      clientId: client_id,
      format: normalizedFormat,
      workspaceId: workspace_id,
      includeVoice: true,
      includeLibrary: true,
      includePerformers: true,
      includeGlobalKnowledge: true,
      includeSuccessPatterns: true,
      includeChecklist: false, // We use our own validation pipeline
    });

    // Track sources used (approximate from prompt content)
    const sourcesUsed: SourcesUsed = {
      identity_guide: writerSystemPrompt.includes("DOCUMENTO MESTRE") || writerSystemPrompt.includes("CONTEXTO OPERACIONAL"),
      library_items_count: (writerSystemPrompt.match(/Exemplo \d+:/g) || []).length,
      top_performers_count: (writerSystemPrompt.match(/Top \d+ \[/g) || []).length,
      format_rules: schema?.format_label || null,
      voice_profile: writerSystemPrompt.includes("VOZ DO CLIENTE") || writerSystemPrompt.includes("USE SEMPRE"),
      global_knowledge: writerSystemPrompt.includes("KNOWLEDGE BASE") || writerSystemPrompt.includes("BASE DE CONHECIMENTO"),
      content_guidelines: writerSystemPrompt.includes("GUIA DE CRIAÇÃO"),
    };

    // =========================================================
    // STEP 2: WRITER (Main generation) - with retry + fallback
    // =========================================================
    console.log("[UNIFIED-API] Step 2: Writer generating content...");
    stepsCompleted.push("writer_started");

    // Check if LLM is configured
    if (!isLLMConfigured()) {
      return new Response(
        JSON.stringify({ 
          error: "Nenhuma chave de IA configurada. Configure GOOGLE_AI_STUDIO_API_KEY ou OPENAI_API_KEY." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const writerMessages: LLMMessage[] = [
      { role: "system", content: writerSystemPrompt },
      { role: "user", content: brief }
    ];

    let writerResult;
    let usedProvider = "google";
    
    const dynamicTemp = getTemperatureForFormat(normalizedFormat);
    
    try {
      writerResult = await callLLM(writerMessages, {
        maxTokens: 8192,
        temperature: dynamicTemp,
        usageContext: { ...usageContext, metadata: { ...usageContext.metadata, step: "writer" } },
      });
      usedProvider = writerResult.provider;
    } catch (error) {
      console.error("[UNIFIED-API] Writer failed:", error);
      
      // Return 503 with retry info
      return createLLMUnavailableResponse(
        error instanceof Error ? error : new Error("Erro ao gerar conteúdo"),
        corsHeaders
      );
    }

    writerTokens = writerResult.tokens;
    let currentContent = writerResult.content;
    stepsCompleted.push("writer_completed");

    console.log(`[UNIFIED-API] Writer generated ${currentContent.length} chars`);

    // =========================================================
    // STEP 3: VALIDATE
    // =========================================================
    console.log("[UNIFIED-API] Step 3: Validating content...");
    stepsCompleted.push("validation_started");

    const parsed = parseOutput(currentContent, normalizedFormat);
    let validationResult = validateContent(parsed, normalizedFormat, clientAvoidList);

    console.log(`[UNIFIED-API] Validation: ${getValidationSummary(validationResult)}`);
    stepsCompleted.push("validation_completed");

    // =========================================================
    // STEP 4: REPAIR (if needed)
    // =========================================================
    let wasRepaired = false;

    if (needsRepair(validationResult) && strict_validation) {
      console.log("[UNIFIED-API] Step 4: Repair needed...");
      stepsCompleted.push("repair_started");

      for (let attempt = 1; attempt <= max_repair_attempts; attempt++) {
        console.log(`[UNIFIED-API] Repair attempt ${attempt}/${max_repair_attempts}`);

        const repairPrompt = buildRepairPrompt(validationResult.violations, currentContent);

        const repairMessages: LLMMessage[] = [
          { role: "system", content: `Você é um editor preciso. Corrija APENAS os problemas listados.\n${formatContract}` },
          { role: "user", content: repairPrompt }
        ];

        try {
          const repairResult = await callLLM(repairMessages, {
            maxTokens: 4096,
            temperature: 0.3,
            usageContext: { ...usageContext, metadata: { ...usageContext.metadata, step: "repair", attempt } },
          });

          repairTokens += repairResult.tokens;
          currentContent = repairResult.content;
          wasRepaired = true;
        } catch (error) {
          console.warn("[UNIFIED-API] Repair failed, continuing with unrepaired content:", error);
          // Don't fail completely - we still have the writer content
          validationResult.warnings.push("Validação de reparo não concluída devido a falha na API");
          break;
        }

        // Re-validate
        const repairedParsed = parseOutput(currentContent, normalizedFormat);
        validationResult = validateContent(repairedParsed, normalizedFormat, clientAvoidList);

        console.log(`[UNIFIED-API] After repair: ${getValidationSummary(validationResult)}`);

        if (!needsRepair(validationResult)) {
          console.log("[UNIFIED-API] Repair successful!");
          break;
        }
      }

      stepsCompleted.push("repair_completed");
    }

    // =========================================================
    // STEP 5: REVIEWER (optional quality check)
    // =========================================================
    let wasReviewed = false;

    if (!skip_review) {
      console.log("[UNIFIED-API] Step 5: Reviewer checking quality...");
      stepsCompleted.push("reviewer_started");

      const reviewerChecklist = buildReviewerChecklist();
      
      // Load voice profile to prevent reviewer from flattening authentic voice
      let voiceSection = '';
      try {
        const vp = await getStructuredVoice(client_id);
        if (vp) voiceSection = vp;
      } catch (e) {
        console.warn("[UNIFIED-API] Could not load voice profile for reviewer:", e);
      }

      const reviewerSystemPrompt = `# VOCÊ É UM REVISOR DE QUALIDADE

Sua tarefa é verificar o conteúdo contra o checklist abaixo.
Se encontrar problemas, corrija-os DIRETAMENTE no conteúdo.
Retorne APENAS o conteúdo corrigido, sem comentários.

${reviewerChecklist}

${formatContract}

${voiceSection ? `## VOZ DO CLIENTE (PRESERVE RIGOROSAMENTE)
${voiceSection}

⚠️ REGRA CRÍTICA: Preserve rigorosamente o tom e as expressões do cliente. 
NÃO "melhore" linguagem que faz parte da voz autêntica.
NÃO substitua gírias, expressões informais ou tom casual que fazem parte do voice profile.
` : ''}

## REGRAS
1. NÃO adicione explicações ou notas
2. NÃO altere o que já está bom
3. Corrija apenas problemas reais do checklist
4. Mantenha o mesmo formato de entrega
5. PRESERVE a voz e personalidade do cliente — não uniformize
`;

      const reviewerMessages: LLMMessage[] = [
        { role: "system", content: reviewerSystemPrompt },
        { role: "user", content: `Revise este conteúdo:\n\n${currentContent}` }
      ];

      try {
        const reviewerResult = await callLLM(reviewerMessages, {
          maxTokens: 4096,
          temperature: 0.3,
          usageContext: { ...usageContext, metadata: { ...usageContext.metadata, step: "reviewer" } },
        });

        reviewerTokens = reviewerResult.tokens;
        currentContent = reviewerResult.content;
        wasReviewed = true;
        stepsCompleted.push("reviewer_completed");
        console.log("[UNIFIED-API] Review completed");
      } catch (error) {
        console.warn("[UNIFIED-API] Review failed, continuing without review:", error);
        // Don't fail completely - we still have the writer/repair content
        stepsCompleted.push("reviewer_skipped");
      }
    }

    // =========================================================
    // FINAL: Build response
    // =========================================================
    
    // Final parse for response
    const finalParsed = parseOutput(currentContent, normalizedFormat);
    const finalValidation = validateContent(finalParsed, normalizedFormat, clientAvoidList);

    const processingTime = Date.now() - startTime;
    const totalTokens = writerTokens + repairTokens + reviewerTokens;

    console.log(`[UNIFIED-API] Completed in ${processingTime}ms, ${totalTokens} tokens`);

    // Note: AI usage is auto-logged inside callLLM via usageContext.
    // We add a final aggregate row for format/validation tracking purposes.
    try {
      await supabase.from("ai_usage_logs").insert({
        user_id: resolvedUserId,
        edge_function: "unified-content-api-summary",
        provider: "google",
        model_name: "multi-agent-pipeline",
        total_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
        format_type: normalizedFormat,
        client_id: client_id,
        validation_passed: finalValidation.valid,
        was_repaired: wasRepaired,
        metadata: {
          format: normalizedFormat,
          processing_time_ms: processingTime,
          aggregate_tokens: totalTokens,
          steps: stepsCompleted,
          sources_used: sourcesUsed,
        },
      });
    } catch (logError) {
      console.error("[UNIFIED-API] Error logging summary:", logError);
    }

    const response: ContentResponse = {
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

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[UNIFIED-API] Error:", error);
    
    const processingTime = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro ao gerar conteúdo",
        steps_completed: stepsCompleted,
        processing_time_ms: processingTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
