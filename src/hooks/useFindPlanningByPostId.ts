// useFindPlanningByPostId — encontra o planning_item correspondente a um post
// publicado externamente (Metricool/etc).
//
// Procura em 2 lugares:
//   1. external_post_id (canônico — populado pelo cron-metricool-poll)
//   2. metadata->>metricool_post_id (legado / fallback)
//
// Usado pelo Performance tab pra abrir Planning ao clicar no post.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PlanningItem } from '@/hooks/usePlanningItems';

export function useFindPlanningByPostId(postId: string | number | null | undefined) {
  return useQuery({
    queryKey: ['planning-by-post-id', String(postId ?? '')],
    queryFn: async (): Promise<PlanningItem | null> => {
      if (!postId) return null;
      const idStr = String(postId);

      // 1. external_post_id match
      const { data: byExternal } = await supabase
        .from('planning_items')
        .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
        .eq('external_post_id', idStr)
        .limit(1);

      if (byExternal && byExternal.length > 0) {
        return byExternal[0] as PlanningItem;
      }

      // 2. metadata->>metricool_post_id match (PostgREST jsonb filter)
      const { data: byMeta } = await supabase
        .from('planning_items')
        .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
        .eq('metadata->>metricool_post_id', idStr)
        .limit(1);

      if (byMeta && byMeta.length > 0) {
        return byMeta[0] as PlanningItem;
      }

      return null;
    },
    enabled: !!postId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Imperative finder — bom pra handlers de click que precisam decidir antes
 * de navegar (sem montar componente).
 */
export async function findPlanningByPostId(postId: string | number): Promise<PlanningItem | null> {
  const idStr = String(postId);
  const { data: byExternal } = await supabase
    .from('planning_items')
    .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
    .eq('external_post_id', idStr)
    .limit(1);
  if (byExternal && byExternal.length > 0) return byExternal[0] as PlanningItem;

  const { data: byMeta } = await supabase
    .from('planning_items')
    .select('*, clients(id,name,avatar_url), kanban_columns(id,name,color,column_type)')
    .eq('metadata->>metricool_post_id', idStr)
    .limit(1);
  return byMeta && byMeta.length > 0 ? (byMeta[0] as PlanningItem) : null;
}
