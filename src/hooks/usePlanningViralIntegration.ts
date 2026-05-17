/**
 * usePlanningViralIntegration — atalhos cross-feature pra gerar Carrossel
 * Viral / Reels Viral a partir de um planning_item.
 *
 * Cobre 2 fluxos:
 *
 *  1. **Gerar Carrossel** (`generateCarouselFromPlanning`)
 *     - Chama `/api/generate-viral-carousel` com `persistAs='carousel'`
 *       (cria só o `viral_carousels` row, sem clonar planning_item).
 *     - Atualiza `planning_items.metadata` adicionando
 *       `viral_carousel_id` + `viral_carousel_slides` pra que o
 *       PlanningItemDialog/Card mostrem o badge "Carrossel gerado"
 *       (ver lógica existente em PlanningItemDialog.tsx@613-651).
 *     - Retorna `{ carouselId, slides }` ou null em erro.
 *
 *  2. **Adaptar Reel Viral** (`sendToReelsAdapter`)
 *     - Reels Viral só ADAPTA reel existente (precisa URL + briefing).
 *       Não tem fluxo "generate-from-scratch" como o SV.
 *     - Empurra payload no `useViralContext.pendingBriefing` (Zustand
 *       cross-app bridge) e navega `?tab=viral-reels-page&client=<id>`.
 *     - O MainApp.tsx do Reels consome no mount inicial e pré-popula
 *       o campo "Ângulo" + (se houver) URL.
 *
 * Por que dois mecanismos diferentes:
 *  - Carrossel é "1-shot generation" — chamada síncrona, salva tudo.
 *  - Reel exige user input adicional (URL do reel-fonte) — então só
 *    abrimos o app já preenchido pra ele completar.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useViralContext } from '@/store/viral-context';
import { apiInvoke } from '@/lib/apiInvoke';
import type { PlanningItem } from '@/hooks/usePlanningItems';

interface GenerateCarouselArgs {
  /** Planning item alvo. Usamos title+content como briefing e client_id pra contexto. */
  item: PlanningItem;
  /** Quantidade de slides — default 8 (padrão SV). */
  slideCount?: number;
}

interface GenerateCarouselResult {
  carouselId: string;
  slides: Array<{ heading?: string; body: string }>;
}

interface AdaptReelArgs {
  item: PlanningItem;
  /** URL opcional de reel-fonte. Se ausente, user vai colar no app. */
  sourceUrl?: string;
}

export function usePlanningViralIntegration() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setPendingBriefing = useViralContext((s) => s.setPendingBriefing);
  const [isGeneratingCarousel, setIsGeneratingCarousel] = useState(false);

  /**
   * Gera carrossel viral e linka no `metadata.viral_carousel_id` do planning.
   * NÃO chama `persistAs='both'` pra não criar UM SEGUNDO planning_item — o
   * card atual já É o "owner" do carrossel.
   */
  const generateCarouselFromPlanning = async ({
    item,
    slideCount = 8,
  }: GenerateCarouselArgs): Promise<GenerateCarouselResult | null> => {
    if (!item.client_id) {
      toast.error('Selecione um cliente antes de gerar carrossel');
      return null;
    }

    // Briefing = título + conteúdo (description fallback). Mínimo 20 chars
    // pra Gemini não cuspir slop.
    const briefing = [item.title, item.content || (item as any).description || '']
      .filter(Boolean)
      .join('\n\n')
      .trim();

    if (briefing.length < 20) {
      toast.error('Adicione mais detalhes (título + conteúdo) antes de gerar');
      return null;
    }

    setIsGeneratingCarousel(true);
    const toastId = toast.loading('Gerando carrossel viral...', {
      description: 'Pode levar 30-60s. Vou avisar quando ficar pronto.',
    });

    try {
      const { data, error } = await apiInvoke<{
        ok: boolean;
        slides?: Array<{ heading?: string; body: string }>;
        carouselId?: string;
        title?: string;
      }>('generate-viral-carousel', {
        body: {
          clientId: item.client_id,
          briefing,
          slideCount,
          title: item.title,
          // persistAs='carousel' → só cria viral_carousels row, sem
          // clonar planning_item (já temos um, é o `item` atual).
          persistAs: 'carousel',
          source: 'planning',
        },
      });

      if (error || !data?.ok || !data.carouselId) {
        toast.dismiss(toastId);
        toast.error(error?.message || 'Falha ao gerar carrossel');
        return null;
      }

      // Bidirectional link: salva carouselId + slides no metadata do planning
      // pra UI do PlanningItemDialog mostrar o banner "Editar no SV".
      const existingMeta = (item.metadata as Record<string, unknown>) || {};
      const updatedMeta = {
        ...existingMeta,
        content_type: 'viral_carousel',
        viral_carousel_id: data.carouselId,
        viral_carousel_slides: data.slides || [],
        viral_carousel_briefing: briefing,
      };

      const { error: updErr } = await supabase
        .from('planning_items')
        .update({
          metadata: updatedMeta as never,
          content_type: 'viral_carousel',
        })
        .eq('id', item.id);

      if (updErr) {
        console.error('[usePlanningViralIntegration] meta update failed:', updErr);
        // Não falha o flow — carrossel foi criado, só o link visual ficou off.
        toast.warning('Carrossel criado mas link com card falhou. Recarregue a página.');
      }

      // Backlink: viral_carousels.planning_item_id → item.id
      // (pra navegação reversa no SV dashboard)
      try {
        await supabase
          .from('viral_carousels' as any)
          .update({ planning_item_id: item.id } as never)
          .eq('id', data.carouselId);
      } catch (linkErr) {
        console.warn('[usePlanningViralIntegration] backlink failed:', linkErr);
      }

      // Invalida cache pra dialog/board re-renderizarem com badge
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });

      toast.dismiss(toastId);
      toast.success('Carrossel viral gerado!', {
        description: `${data.slides?.length ?? slideCount} slides prontos pra editar`,
        action: {
          label: 'Abrir editor',
          onClick: () => {
            const params = new URLSearchParams({
              client: item.client_id || '',
              tab: 'viral-carrossel',
              carouselId: data.carouselId!,
            });
            navigate(`/kaleidos?${params.toString()}`);
          },
        },
      });

      return {
        carouselId: data.carouselId,
        slides: data.slides || [],
      };
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Erro ao gerar carrossel: ' + (err?.message || String(err)));
      return null;
    } finally {
      setIsGeneratingCarousel(false);
    }
  };

  /**
   * 2026-05-16: `sendToReelsAdapter` removido. Reels Viral saiu do KAI;
   * vive como app standalone em reels.kaleidos.com.br. Callers que precisem
   * adaptar reel devem abrir o app externo direto.
   */
  const sendToReelsAdapter = (_args: AdaptReelArgs) => {
    toast.info('Reels Viral agora é um app separado', {
      description: 'Abre em reels.kaleidos.com.br',
    });
  };

  return {
    generateCarouselFromPlanning,
    isGeneratingCarousel,
    sendToReelsAdapter,
  };
}
