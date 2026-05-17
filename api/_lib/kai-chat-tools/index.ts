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
  type KAIApprovalRequest,
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
// 2026-05-16: analyzeViralReelTool/createRadarBriefTool removidos junto com
// Reels Viral + Radar Viral (commit e4575fce). Handlers downstream deletados.
export { createTeamTaskTool } from './createTeamTask.js';
export { saveToLibraryTool } from './saveToLibrary.js';
export { createAutomationTool } from './createAutomation.js';
export { listAutomationsTool } from './listAutomations.js';
export { toggleAutomationTool } from './toggleAutomation.js';
export { updateClientTool } from './updateClient.js';
export { searchRefsTool } from './searchRefs.js';
export { listClientsTool } from './listClients.js';
export { createClientTool } from './createClient.js';
export { addToPlanningTool } from './addToPlanning.js';
export { getPostTranscriptionTool } from './getPostTranscription.js';
export { getPlanningItemTool } from './getPlanningItem.js';
export { getRecentPerformanceTool } from './getRecentPerformance.js';

// READ agregadores (2026-05-16) — workspace, brand, voice, integrações,
// auditoria, refs full, workflows, notificações, atividade, UI state.
export { getWorkspaceMembersTool } from './getWorkspaceMembers.js';
export { getBrandAssetsTool } from './getBrandAssets.js';
export { getVoiceProfileTool } from './getVoiceProfile.js';
export { getIntegrationsStatusTool } from './getIntegrationsStatus.js';
export { getAuditLogTool } from './getAuditLog.js';
export { getReferencesTool } from './getReferences.js';
export { getWorkflowsTool } from './getWorkflows.js';
export { getNotificationsTool } from './getNotifications.js';
export { getRecentActivityTool } from './getRecentActivity.js';
export { getUIStateTool } from './getUIState.js';

// WRITE / EDIT (2026-05-16) — controle pleno tasks/workflows/members/brand/voice/refs.
export { editTaskTool } from './editTask.js';
export { updateWorkflowTool } from './updateWorkflow.js';
export { addWorkspaceMemberTool } from './addWorkspaceMember.js';
export { removeWorkspaceMemberTool } from './removeWorkspaceMember.js';
export { updateMemberRoleTool } from './updateMemberRole.js';
export { updateBrandAssetsTool } from './updateBrandAssets.js';
export { updateVoiceProfileTool } from './updateVoiceProfile.js';
export { addReferenceTool } from './addReference.js';
export { editReferenceTool } from './editReference.js';
export { updateClientSettingsTool } from './updateClientSettings.js';

// DELETE (2026-05-16) — TODAS exigem `approved: true` (approval flow).
export { deleteContentTool } from './deleteContent.js';
export { deleteTaskTool } from './deleteTask.js';
export { deletePlanningItemTool } from './deletePlanningItem.js';
export { deleteReferenceTool } from './deleteReference.js';
export { deleteAutomationTool } from './deleteAutomation.js';
