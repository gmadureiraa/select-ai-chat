
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@sv/lib/supabase";
import {
  fetchUserCarousel,
  isCarouselUuid,
  upsertUserCarousel,
  type SavedCarousel,
} from "@sv/lib/carousel-storage";
import type { TemplateId as VisualTemplateId } from "@sv/components/app/templates/types";
import type { CreateSlide } from "./types";

/**
 * Hooks pra carregar e salvar rascunhos. Reaproveita `upsertUserCarousel` /
 * `fetchUserCarousel` do arquivo legado — lógica Supabase intacta.
 */

export interface DraftPayload {
  title: string;
  slides: CreateSlide[];
  slideStyle: "white" | "dark";
  visualTemplate?: VisualTemplateId;
  status?: "draft" | "published" | "archived";
  accentOverride?: string;
  displayFont?: string;
  textScale?: number;
  // KAI multi-tenant context — vem do useKaiContext() no caller. Pra UPDATE
  // não importa (id já existe). Pra INSERT new, evita cair no fallback do
  // trigger (workspace mais recente do user).
  workspaceId?: string | null;
  clientId?: string | null;
}

export function useDraft(id: string | null) {
  const [draft, setDraft] = useState<SavedCarousel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Early returns precisam zerar loading/error explicitamente — caso
    // contrário ficam presos no estado anterior se o id mudar pra falsy.
    if (!id || !supabase) {
      setLoading(false);
      setError(null);
      setDraft(null);
      return;
    }
    if (!isCarouselUuid(id)) {
      setLoading(false);
      setError("Rascunho inválido.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const c = await fetchUserCarousel(supabase!, id);
        if (cancelled) return;
        if (!c) {
          setError("Rascunho não encontrado.");
          return;
        }
        setDraft(c);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao carregar rascunho.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { draft, setDraft, loading, error };
}

export function useSaveDraft(userId: string | null, _session: Session | null) {
  const saveNow = useCallback(
    async (
      id: string | null,
      payload: DraftPayload
    ): Promise<SavedCarousel | null> => {
      if (!userId || !supabase) return null;
      const { row, inserted } = await upsertUserCarousel(supabase, userId, {
        id,
        title: payload.title,
        slides: payload.slides,
        slideStyle: payload.slideStyle,
        status: payload.status ?? "draft",
        visualTemplate: payload.visualTemplate,
        accentOverride: payload.accentOverride,
        displayFont: payload.displayFont,
        textScale: payload.textScale,
        workspaceId: payload.workspaceId,
        clientId: payload.clientId,
      });
      return {
        id: row.id,
        title: row.title ?? payload.title,
        slides: payload.slides,
        style: payload.slideStyle,
        savedAt: row.updated_at || row.created_at,
        status: payload.status ?? "draft",
        visualTemplate: payload.visualTemplate,
        _inserted: inserted,
      } as SavedCarousel & { _inserted: boolean };
    },
    [userId]
  );
  return { saveNow };
}

/** Auto-save debounced (1200ms) — devolve estado idle/saving/saved. */
export function useAutoSaveDraft({
  userId,
  id,
  slides,
  title,
  slideStyle,
  visualTemplate,
  accentOverride,
  displayFont,
  textScale,
  enabled,
  workspaceId,
  clientId,
}: {
  userId: string | null;
  id: string | null;
  slides: CreateSlide[];
  title: string;
  slideStyle: "white" | "dark";
  visualTemplate?: VisualTemplateId;
  accentOverride?: string;
  displayFont?: string;
  textScale?: number;
  enabled: boolean;
  workspaceId?: string | null;
  clientId?: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastRef = useRef<string>("");
  // Marca o primeiro render pra evitar auto-save disparar antes da hidratação
  // do draft (slides ainda vazios + overrides undefined).
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || !id || !supabase) return;
    if (slides.length === 0) return;

    const serialized = JSON.stringify({
      slides,
      title,
      slideStyle,
      visualTemplate,
      accentOverride,
      displayFont,
      textScale,
    });

    // Primeiro ciclo: grava baseline sem disparar PATCH (evita escrever
    // overrides undefined em cima dos já salvos).
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastRef.current = serialized;
      return;
    }
    if (serialized === lastRef.current) return;

    const handle = window.setTimeout(async () => {
      setStatus("saving");
      try {
        await upsertUserCarousel(supabase!, userId, {
          id,
          title,
          slides,
          slideStyle,
          status: "draft",
          visualTemplate,
          accentOverride,
          displayFont,
          textScale,
          workspaceId,
          clientId,
        });
        lastRef.current = serialized;
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("idle");
      }
    }, 1200);

    return () => window.clearTimeout(handle);
  }, [
    enabled,
    userId,
    id,
    slides,
    title,
    slideStyle,
    visualTemplate,
    accentOverride,
    displayFont,
    textScale,
  ]);

  return { status };
}
