// findPlanningByPostId — encontra o planning_item correspondente a um post
// publicado externamente (Metricool/etc).
//
// Procura em 2 lugares:
//   1. external_post_id (canônico — populado pelo cron-metricool-poll)
//   2. metadata->>metricool_post_id (legado / fallback)
//
// Gap #6 — `workspaceId` é obrigatório pra impedir leak cross-workspace.
//
// Usado por useOpenPlanningFromPost no Performance tab pra abrir Planning ao
// clicar no post.
import { supabase } from '@/integrations/supabase/client';
import type { PlanningItem } from '@/hooks/usePlanningItems';

/**
 * Imperative finder — bom pra handlers de click que precisam decidir antes
 * de navegar (sem montar componente).
 */
export async function findPlanningByPostId(
  postId: string | number,
  workspaceId: string,
): Promise<PlanningItem | null> {
  const idStr = String(postId);
  if (!workspaceId) return null;
  const { data: byExternal } = await supabase
    .from('planning_items')
    .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
    .eq('workspace_id', workspaceId)
    .eq('external_post_id', idStr)
    .limit(1);
  if (byExternal && byExternal.length > 0) return byExternal[0] as PlanningItem;

  const { data: byMeta } = await supabase
    .from('planning_items')
    .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
    .eq('workspace_id', workspaceId)
    .eq('metadata->>metricool_post_id', idStr)
    .limit(1);
  return byMeta && byMeta.length > 0 ? (byMeta[0] as PlanningItem) : null;
}
