/**
 * Barrel export do módulo de tools do kai-simple-chat.
 * Re-exporta tipos, registry e runner pra simplificar imports no index.ts.
 */
export type {
  RegisteredTool,
  ToolDefinition,
  ToolExecutionContext,
  ToolHandler,
  ToolHandlerResult,
  ToolParameterSchema,
  SupabaseClient,
} from "./types.ts";

export { ToolRegistry } from "./registry.ts";

export {
  runToolLoop,
  type GeminiContent,
  type GeminiPart,
  type GeminiStreamResponse,
  type RunToolLoopOptions,
} from "./runner.ts";

export { echoTool } from "./echo.ts";
export { createContentTool } from "./createContent.ts";
export { createViralCarouselTool } from "./createViralCarousel.ts";
export { editContentTool } from "./editContent.ts";
export { listPendingApprovalsTool } from "./listPendingApprovals.ts";
export { getClientContextTool } from "./getClientContext.ts";
export { searchLibraryTool } from "./searchLibrary.ts";
export { publishNowTool } from "./publishNow.ts";
export { scheduleForTool } from "./scheduleFor.ts";
export { connectAccountTool } from "./connectAccount.ts";
export { getMetricsTool } from "./getMetrics.ts";
