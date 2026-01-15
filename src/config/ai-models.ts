/**
 * Centralized AI model configuration for frontend components
 */

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
 * Format credits for display (divide by 1000)
 */
export function formatCredits(tokens: number): string {
  const credits = Math.round(tokens / 1000);
  return credits.toLocaleString("pt-BR");
}
