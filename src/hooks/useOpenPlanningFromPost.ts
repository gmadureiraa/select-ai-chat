// useOpenPlanningFromPost — cria um onClick handler pra abrir o PlanningItemDialog
// correspondente a um post publicado externamente (Metricool/etc).
//
// Fluxo:
//   1. Tenta achar planning_item via external_post_id ou metadata.metricool_post_id
//   2. Se achou: navega pra /kaleidos?tab=planning&openItem={id} (Kai.tsx lida)
//   3. Se não achou: fallback abre URL externa (post original)
import { useNavigate, useSearchParams } from 'react-router-dom';
import { findPlanningByPostId } from './useFindPlanningByPostId';
import { useWorkspace } from '@/hooks/useWorkspace';

export function useOpenPlanningFromPost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workspace } = useWorkspace();

  return async (post: { id: string | number; url?: string; permalink?: string }) => {
    if (!post?.id) {
      const fallback = post?.url || post?.permalink;
      if (fallback) window.open(fallback, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      // Gap #6 — passa workspaceId pro lookup ser scoped (RLS safety).
      if (!workspace?.id) {
        const fallback = post.url || post.permalink;
        if (fallback) window.open(fallback, '_blank', 'noopener,noreferrer');
        return;
      }
      const planning = await findPlanningByPostId(post.id, workspace.id);
      if (planning) {
        // Preserva client atual + força tab=planning + openItem
        const params = new URLSearchParams(searchParams);
        params.set('tab', 'planning');
        params.set('openItem', planning.id);
        if (planning.client_id && !params.get('client')) {
          params.set('client', planning.client_id);
        }
        navigate(`/kaleidos?${params.toString()}`);
        return;
      }
    } catch (err) {
      console.warn('[useOpenPlanningFromPost] lookup falhou:', err);
    }
    // Fallback: abre o post original
    const fallback = post.url || post.permalink;
    if (fallback) window.open(fallback, '_blank', 'noopener,noreferrer');
  };
}
