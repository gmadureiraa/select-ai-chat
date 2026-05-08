/**
 * Barrel export do módulo de tools do kai-simple-chat (Node port).
 */
export type {
  RegisteredTool,
  ToolDefinition,
  ToolExecutionContext,
  ToolHandler,
  ToolHandlerResult,
  ToolParameterSchema,
} from './types.js';

export { ToolRegistry } from './registry.js';

export {
  runToolLoop,
  type GeminiContent,
  type GeminiPart,
  type GeminiStreamResponse,
  type RunToolLoopOptions,
} from './runner.js';

export {
  createKAIEmitter,
  newActionCardId,
  newToolCallId,
  type KAIActionCard,
  type KAIActionCardData,
  type KAIActionCardStatus,
  type KAIActionCardType,
  type KAICardAction,
  type KAIDraftCardData,
  type KAIErrorCardData,
  type KAILibraryMatchCardData,
  type KAIMetricCardData,
  type KAIPublishedCardData,
  type KAIScheduledCardData,
  type KAIConnectAccountCardData,
  type KAIStreamDelta,
  type KAIStreamEmitter,
  type KAIToolResult,
  type KAIToolRunning,
} from './kai-stream.js';

export { echoTool } from './echo.js';
export { createContentTool } from './createContent.js';
export { createViralCarouselTool } from './createViralCarousel.js';
export { editContentTool } from './editContent.js';
export { listPendingApprovalsTool } from './listPendingApprovals.js';
export { getClientContextTool } from './getClientContext.js';
export { searchLibraryTool } from './searchLibrary.js';
export { publishNowTool } from './publishNow.js';
export { scheduleForTool } from './scheduleFor.js';
export { connectAccountTool } from './connectAccount.js';
export { getMetricsTool } from './getMetrics.js';
export { analyzeViralReelTool } from './analyzeViralReel.js';
export { createRadarBriefTool } from './createRadarBrief.js';
