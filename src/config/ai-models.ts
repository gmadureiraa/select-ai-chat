/**
 * Centralized AI model configuration for frontend components
 */

/**
 * Model pricing per 1M tokens (input/output) in USD
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Gemini models
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gemini-2.0-flash-lite": { input: 0.02, output: 0.08 },
  "gemini-2.5-flash-lite": { input: 0.02, output: 0.08 },
  "gemini-3-flash-preview": { input: 0.10, output: 0.40 },
  "gemini-3-pro-preview": { input: 1.50, output: 6.00 },
  // Aliases
  "flash": { input: 0.075, output: 0.30 },
  "pro": { input: 1.25, output: 5.00 },
  "flash-lite": { input: 0.02, output: 0.08 },
  // OpenAI models
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-5": { input: 5.00, output: 15.00 },
  "gpt-5-mini": { input: 0.30, output: 1.20 },
  "gpt-5-nano": { input: 0.10, output: 0.40 },
  // Anthropic models
  "claude-3-5-sonnet": { input: 3.00, output: 15.00 },
  "claude-3-opus": { input: 15.00, output: 75.00 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
};

/**
 * Agent step icons and labels for pipeline visualization
 */
export const AGENT_STEPS = {
  researcher: { icon: "🔍", label: "Pesquisador", color: "blue" },
  writer: { icon: "✍️", label: "Escritor", color: "violet" },
  editor: { icon: "📝", label: "Editor", color: "rose" },
  reviewer: { icon: "✅", label: "Revisor", color: "emerald" },
} as const;

/**
 * Process step labels for content generation
 */
export const PROCESS_STEP_LABELS: Record<string, string> = {
  analyzing: "Analisando sua solicitação...",
  analyzing_library: "Lendo biblioteca de conteúdo...",
  selecting: "Selecionando referências...",
  reviewing: "Preparando contexto...",
  creating: "Gerando resposta...",
  generating_image: "Gerando imagem com IA...",
  multi_agent: "Pipeline multi-agente ativo...",
};

/**
 * Multi-agent step labels
 */
export const MULTI_AGENT_STEP_LABELS: Record<string, string> = {
  researcher: "🔍 Pesquisador analisando contexto...",
  writer: "✍️ Escritor criando rascunho...",
  editor: "📝 Editor de estilo refinando...",
  reviewer: "✅ Revisor finalizando...",
  complete: "✨ Completo!",
  error: "❌ Erro no processamento",
};

/**
 * Estimate cost for a given model and token count
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["gemini-2.5-flash"];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(3)}`;
}

/**
 * Get provider from model name
 */
export function getProvider(model: string): string {
  if (model.includes("gemini")) return "google";
  if (model.includes("gpt")) return "openai";
  if (model.includes("claude")) return "anthropic";
  return "unknown";
}
