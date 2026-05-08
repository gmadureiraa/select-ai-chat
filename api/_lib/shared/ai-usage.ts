// =====================================================
// AI USAGE LOGGING (Node port)
// Ported from supabase/functions/_shared/ai-usage.ts
// Uses Neon (pg) instead of Supabase client.
// =====================================================
import { getPool } from '../db.js';

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 1.5, output: 6.0 },
  'gemini-2.5-flash-lite': { input: 0.75, output: 3.0 },
  'gemini-2.5-pro': { input: 7.0, output: 21.0 },
  'gemini-2.5-pro-preview-06-05': { input: 7.0, output: 21.0 },
  'gemini-2.0-flash': { input: 1.0, output: 4.0 },
  'gemini-2.0-flash-exp': { input: 0.0, output: 0.0 },
  'gemini-2.0-flash-lite': { input: 0.5, output: 2.0 },
  'gemini-1.5-flash': { input: 0.75, output: 3.0 },
  'gemini-1.5-pro': { input: 7.0, output: 21.0 },
  'gemini-3-pro-preview': { input: 0.0, output: 0.0 },
  'gemini-3-pro-image-preview': { input: 0.0, output: 0.0 },
  'gemini-2.5-flash-image': { input: 0.0, output: 0.0 },
  'google/gemini-2.5-flash': { input: 1.5, output: 6.0 },
  'google/gemini-2.5-flash-lite': { input: 0.75, output: 3.0 },
  'google/gemini-2.5-pro': { input: 7.0, output: 21.0 },
  'google/gemini-3-pro-preview': { input: 0.0, output: 0.0 },
  'google/gemini-3-pro-image-preview': { input: 0.0, output: 0.0 },
  'google/gemini-2.5-flash-image': { input: 0.0, output: 0.0 },
  'gpt-5': { input: 5.0, output: 15.0 },
  'gpt-5-mini': { input: 0.3, output: 1.2 },
  'gpt-5-nano': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.3, output: 1.2 },
  'gpt-image-1': { input: 5.0, output: 0.0 },
  'dall-e-3': { input: 0.0, output: 0.0 },
  'imagen-4': { input: 0.0, output: 0.0 },
  'whisper-1': { input: 100.0, output: 0.0 },
  'multi-agent-pipeline': { input: 0.0, output: 0.0 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const modelLower = model.toLowerCase();
    for (const [key, value] of Object.entries(MODEL_PRICING)) {
      if (modelLower.includes(key.toLowerCase().replace('google/', '').replace('openai/', ''))) {
        pricing = value;
        break;
      }
    }
  }
  if (!pricing) pricing = MODEL_PRICING['gemini-2.5-flash'];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export function getProvider(model: string): string {
  const m = model.toLowerCase();
  if (m.includes('gemini')) return 'google';
  if (m.includes('gpt-') || m.includes('openai')) return 'openai';
  if (m.includes('claude') || m.includes('anthropic')) return 'anthropic';
  if (m.startsWith('google/')) return 'google';
  if (m.startsWith('openai/')) return 'openai';
  return 'unknown';
}

export async function logAIUsage(
  userId: string,
  model: string,
  edgeFunction: string,
  inputTokens: number,
  outputTokens: number,
  metadata: Record<string, any> = {}
): Promise<void> {
  if (!userId) return;
  try {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = estimateCost(model, inputTokens, outputTokens);
    const provider = getProvider(model);
    const clientId = metadata.client_id || null;
    const cleanMeta = { ...metadata };
    delete cleanMeta.client_id;

    await getPool().query(
      `INSERT INTO ai_usage_logs
        (user_id, model_name, provider, edge_function, input_tokens, output_tokens, total_tokens, estimated_cost_usd, client_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())`,
      [
        userId,
        model,
        provider,
        edgeFunction,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        clientId,
        Object.keys(cleanMeta).length > 0 ? JSON.stringify(cleanMeta) : null,
      ]
    );
    console.log(`[AI-USAGE] ${edgeFunction}: ${model} - ${totalTokens} tokens - $${estimatedCost.toFixed(6)}${clientId ? ` (client: ${clientId})` : ''}`);
  } catch (error) {
    // Backwards-compatible fallback for older schema (model column instead of model_name)
    try {
      const cleanMeta = { ...metadata };
      const clientId = metadata.client_id || null;
      delete cleanMeta.client_id;
      await getPool().query(
        `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [
          userId,
          model,
          edgeFunction,
          inputTokens,
          outputTokens,
          JSON.stringify({ ...cleanMeta, ...(clientId ? { client_id: clientId } : {}) }),
        ]
      );
    } catch (e2) {
      console.warn(`[AI-USAGE] failed for ${edgeFunction}:`, e2);
    }
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

export function estimateImageTokens(imageCount: number): number {
  return imageCount * 258;
}
