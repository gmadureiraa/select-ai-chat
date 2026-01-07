import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pricing por 1M tokens (USD) - Preços Google Cloud Billing (Janeiro 2026)
// Baseado em custo real: R$46.9 = ~$7.80 USD para ~1.7M tokens
// https://cloud.google.com/vertex-ai/generative-ai/pricing
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Google Gemini Models - Production Tier (Vertex AI / Pay-as-you-go)
  // Preços reais de produção são ~10x maiores que o free tier
  "gemini-2.5-flash": { input: 1.50, output: 6.00 },       // Production tier
  "gemini-2.5-flash-lite": { input: 0.75, output: 3.00 }, 
  "gemini-2.5-pro": { input: 7.00, output: 21.00 },
  "gemini-2.0-flash": { input: 1.00, output: 4.00 },
  "gemini-2.0-flash-exp": { input: 0.00, output: 0.00 },   // Experimental - free
  "gemini-2.0-flash-lite": { input: 0.50, output: 2.00 },
  "gemini-1.5-flash": { input: 0.75, output: 3.00 },
  "gemini-1.5-pro": { input: 7.00, output: 21.00 },
  "gemini-3-pro-preview": { input: 0.00, output: 0.00 },   // Preview - free
  
  // Lovable AI Gateway Models (same pricing as underlying production)
  "google/gemini-2.5-flash": { input: 1.50, output: 6.00 },
  "google/gemini-2.5-flash-lite": { input: 0.75, output: 3.00 },
  "google/gemini-2.5-pro": { input: 7.00, output: 21.00 },
  "google/gemini-3-pro-preview": { input: 0.00, output: 0.00 },
  
  // OpenAI Models
  "gpt-5": { input: 5.00, output: 15.00 },
  "gpt-5-mini": { input: 0.30, output: 1.20 },
  "gpt-5-nano": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 5.00, output: 15.00 },
  "gpt-4o-mini": { input: 0.30, output: 1.20 },
  "gpt-image-1": { input: 5.00, output: 0.00 },  // Image generation model
  "openai/gpt-5": { input: 5.00, output: 15.00 },
  "openai/gpt-5-mini": { input: 0.30, output: 1.20 },
  "openai/gpt-5-nano": { input: 0.15, output: 0.60 },
  
  // Anthropic Models
  "claude-sonnet-4-5": { input: 3.00, output: 15.00 },
  "claude-3-5-sonnet": { input: 3.00, output: 15.00 },
  
  // Pipeline/composite (zero - individual calls logged separately)
  "multi-agent-pipeline": { input: 0.00, output: 0.00 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Try exact match first
  let pricing = MODEL_PRICING[model];
  
  // If not found, try to find by partial match
  if (!pricing) {
    const modelLower = model.toLowerCase();
    for (const [key, value] of Object.entries(MODEL_PRICING)) {
      if (modelLower.includes(key.toLowerCase().replace("google/", "").replace("openai/", ""))) {
        pricing = value;
        break;
      }
    }
  }
  
  // Default to gemini-2.5-flash pricing if unknown
  if (!pricing) {
    console.warn(`[AI-USAGE] Unknown model pricing: ${model}, using gemini-2.5-flash as default`);
    pricing = MODEL_PRICING["gemini-2.5-flash"];
  }
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function getProvider(model: string): string {
  const modelLower = model.toLowerCase();
  if (modelLower.includes("gemini")) return "google";
  if (modelLower.includes("gpt-") || modelLower.includes("openai")) return "openai";
  if (modelLower.includes("claude") || modelLower.includes("anthropic")) return "anthropic";
  if (modelLower.startsWith("google/")) return "google";
  if (modelLower.startsWith("openai/")) return "openai";
  return "unknown";
}

export async function logAIUsage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  model: string,
  edgeFunction: string,
  inputTokens: number,
  outputTokens: number,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = estimateCost(model, inputTokens, outputTokens);
    const provider = getProvider(model);

    const { error } = await supabase.from("ai_usage_logs").insert({
      user_id: userId,
      model_name: model,
      provider,
      edge_function: edgeFunction,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCost,
      metadata,
    });

    if (error) {
      console.error(`[AI-USAGE] Failed to log for ${edgeFunction}:`, error);
    } else {
      console.log(`[AI-USAGE] ${edgeFunction}: ${model} - ${totalTokens} tokens - $${estimatedCost.toFixed(6)}`);
    }
  } catch (error) {
    console.error(`[AI-USAGE] Error logging for ${edgeFunction}:`, error);
  }
}

// Estima tokens baseado no tamanho do texto (aproximação)
export function estimateTokens(text: string): number {
  // Aproximação: ~4 caracteres por token para texto em português
  return Math.ceil(text.length / 4);
}

// Estima tokens de imagem (baseado em docs do Gemini)
export function estimateImageTokens(imageCount: number): number {
  // Gemini: ~258 tokens por imagem em média
  return imageCount * 258;
}

// Helper para criar cliente Supabase
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}
