// useFindPlanningByPostId — encontra o planning_item correspondente a um post
// publicado externamente (Metricool/etc).
//
// Procura em 2 lugares:
//   1. external_post_id (canônico — populado pelo cron-metricool-poll)
//   2. metadata->>metricool_post_id (legado / fallback)
//
// Gap #6 — sempre filtra por workspace_id (RLS safety). Sem workspaceId nada é
// retornado, evita cross-workspace leaks. Hook puxa do useWorkspace() ativo.
//
// Usado pelo Performance tab pra abrir Planning ao clicar no post.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { PlanningItem } from '@/hooks/usePlanningItems';

export function useFindPlanningByPostId(postId: string | number | null | undefined) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id;

  return useQuery({
    queryKey: ['planning-by-post-id', String(postId ?? ''), workspaceId ?? ''],
    queryFn: async (): Promise<PlanningItem | null> => {
      if (!postId || !workspaceId) return null;
      const idStr = String(postId);

      // 1. external_post_id match (escopado no workspace)
      const { data: byExternal } = await supabase
        .from('planning_items')
        .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
        .eq('workspace_id', workspaceId)
        .eq('external_post_id', idStr)
        .limit(1);

      if (byExternal && byExternal.length > 0) {
        return byExternal[0] as PlanningItem;
      }

      // 2. metadata->>metricool_post_id match (PostgREST jsonb filter)
      const { data: byMeta } = await supabase
        .from('planning_items')
        .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
        .eq('workspace_id', workspaceId)
        .eq('metadata->>metricool_post_id', idStr)
        .limit(1);

      if (byMeta && byMeta.length > 0) {
        return byMeta[0] as PlanningItem;
      }

      return null;
    },
    enabled: !!postId && !!workspaceId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Imperative finder — bom pra handlers de click que precisam decidir antes
 * de navegar (sem montar componente).
 *
 * Gap #6 — `workspaceId` agora é obrigatório (passar via contexto useWorkspace)
 * pra impedir leak cross-workspace. Caller responsável por consultar o contexto.
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
