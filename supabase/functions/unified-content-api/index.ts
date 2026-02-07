// =====================================================
// UNIFIED CONTENT API
// Single entry point for impeccable content generation
// Pipeline: Writer → Validate → Repair → Review
// Version 1.0 - "Impeccable Content" architecture
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
  getFullContentContext,
  getStructuredVoice,
  getClientAvoidList,
  normalizeFormatKey,
} from "../_shared/knowledge-loader.ts";

import {
  buildForbiddenPhrasesSection,
  UNIVERSAL_OUTPUT_RULES,
  buildReviewerChecklist,
} from "../_shared/quality-rules.ts";

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
  };
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// AI CALL HELPER
// =====================================================

async function callGemini(
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ content: string; tokens: number }> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
  }

  // Convert to Gemini format and merge consecutive same-role messages
  const geminiContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    
    if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
      // Merge with previous
      geminiContents[geminiContents.length - 1].parts[0].text += "\n\n" + msg.content;
    } else {
      geminiContents.push({
        role,
        parts: [{ text: msg.content }]
      });
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[UNIFIED-API] Gemini error:", errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit excedido. Tente novamente em alguns segundos.");
    }
    
    throw new Error("Erro ao gerar conteúdo");
  }

  const result = await response.json();
  const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Estimate tokens (Gemini doesn't always return token count)
  const inputTokens = result?.usageMetadata?.promptTokenCount || 0;
  const outputTokens = result?.usageMetadata?.candidatesTokenCount || 0;
  
  return {
    content,
    tokens: inputTokens + outputTokens
  };
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const stepsCompleted: string[] = [];

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

    const normalizedFormat = normalizeFormatKey(format);
    console.log(`[UNIFIED-API] Starting generation for format: ${normalizedFormat}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Token tracking
    let writerTokens = 0;
    let repairTokens = 0;
    let reviewerTokens = 0;

    // =========================================================
    // STEP 1: LOAD CONTEXT
    // =========================================================
    console.log("[UNIFIED-API] Step 1: Loading context...");
    stepsCompleted.push("context_loaded");

    // Get format schema
    const schema = getFormatSchema(normalizedFormat);
    if (!schema && strict_validation) {
      console.warn(`[UNIFIED-API] No schema found for format: ${normalizedFormat}`);
    }

    // Get format contract
    const formatContract = buildFormatContract(normalizedFormat);

    // Get structured voice (Use/Avoid)
    const structuredVoice = await getStructuredVoice(client_id);

    // Get client avoid list for validation
    const clientAvoidList = await getClientAvoidList(client_id);

    // Get full content context (identity, library, top performers)
    const fullContext = await getFullContentContext({
      clientId: client_id,
      format: normalizedFormat,
      workspaceId: workspace_id,
      includeLibrary: true,
      includeTopPerformers: true,
      includeGlobalKnowledge: true,
      includeSuccessPatterns: true,
      includeChecklist: false, // We use our own validation
    });

    // Track sources used
    const sourcesUsed: SourcesUsed = {
      identity_guide: fullContext.includes("GUIA DE IDENTIDADE") || fullContext.includes("identity"),
      library_items_count: (fullContext.match(/\[BIBLIOTECA\]/g) || []).length,
      top_performers_count: (fullContext.match(/\[TOP PERFORMER\]/g) || []).length,
      format_rules: schema?.format_label || null,
      voice_profile: structuredVoice.includes("USE SEMPRE") || structuredVoice.includes("EVITE SEMPRE"),
      global_knowledge: fullContext.includes("KNOWLEDGE BASE") || fullContext.includes("conhecimento global"),
    };

    // Get forbidden phrases section
    const forbiddenPhrases = buildForbiddenPhrasesSection();

    // =========================================================
    // STEP 2: WRITER (Main generation)
    // =========================================================
    console.log("[UNIFIED-API] Step 2: Writer generating content...");
    stepsCompleted.push("writer_started");

    const writerSystemPrompt = `# VOCÊ É UM COPYWRITER ESPECIALISTA

${UNIVERSAL_OUTPUT_RULES}

${formatContract}

${forbiddenPhrases}

${structuredVoice}

${fullContext}

## TAREFA
Crie conteúdo seguindo RIGOROSAMENTE o formato de entrega acima.
Seu output deve conter APENAS o conteúdo final - nada de explicações.
`;

    const writerMessages = [
      { role: "system", content: writerSystemPrompt },
      { role: "user", content: brief }
    ];

    const writerResult = await callGemini(writerMessages, {
      maxTokens: 8192,
      temperature: 0.7,
    });

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

        const repairMessages = [
          { role: "system", content: `Você é um editor preciso. Corrija APENAS os problemas listados.\n${formatContract}` },
          { role: "user", content: repairPrompt }
        ];

        const repairResult = await callGemini(repairMessages, {
          maxTokens: 4096,
          temperature: 0.3, // Lower temperature for precise corrections
        });

        repairTokens += repairResult.tokens;
        currentContent = repairResult.content;
        wasRepaired = true;

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

      const reviewerSystemPrompt = `# VOCÊ É UM REVISOR DE QUALIDADE

Sua tarefa é verificar o conteúdo contra o checklist abaixo.
Se encontrar problemas, corrija-os DIRETAMENTE no conteúdo.
Retorne APENAS o conteúdo corrigido, sem comentários.

${reviewerChecklist}

${formatContract}

## REGRAS
1. NÃO adicione explicações ou notas
2. NÃO altere o que já está bom
3. Corrija apenas problemas reais do checklist
4. Mantenha o mesmo formato de entrega
`;

      const reviewerMessages = [
        { role: "system", content: reviewerSystemPrompt },
        { role: "user", content: `Revise este conteúdo:\n\n${currentContent}` }
      ];

      // Use lighter model for review
      const reviewerResult = await callGemini(reviewerMessages, {
        maxTokens: 4096,
        temperature: 0.3,
      });

      reviewerTokens = reviewerResult.tokens;
      currentContent = reviewerResult.content;
      wasReviewed = true;

      stepsCompleted.push("reviewer_completed");
      console.log("[UNIFIED-API] Review completed");
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

    // Log to ai_usage_logs with format tracking
    try {
      await supabase.from("ai_usage_logs").insert({
        user_id: req.headers.get("x-user-id") || "system",
        edge_function: "unified-content-api",
        provider: "google",
        model_name: "gemini-2.5-flash",
        total_tokens: totalTokens,
        format_type: normalizedFormat,
        client_id: client_id,
        validation_passed: finalValidation.valid,
        was_repaired: wasRepaired,
        metadata: {
          format: normalizedFormat,
          processing_time_ms: processingTime,
          steps: stepsCompleted,
          sources_used: sourcesUsed,
        },
      });
    } catch (logError) {
      console.error("[UNIFIED-API] Error logging usage:", logError);
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
      },
    };
      metadata: {
        format: normalizedFormat,
        format_label: schema?.format_label || normalizedFormat,
        processing_time_ms: processingTime,
        steps_completed: stepsCompleted,
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
