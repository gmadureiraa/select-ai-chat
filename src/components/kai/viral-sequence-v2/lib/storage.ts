/**
 * Storage da Sequência Viral v2.
 *
 * - Rascunho atual em sessionStorage (autosave, sobrevive a refresh).
 * - Carrosséis salvos no Supabase/Neon (`viral_carousels`).
 *
 * Distinto do legacy `viral-sequence/storage.ts` no STORAGE_KEY (não conflita)
 * e suporta heading + body separados.
 */

import { supabase } from "@/integrations/supabase/client";
import { migrateSlide, type ViralCarousel } from "../types";

const STORAGE_KEY = "kai-viral-sequence-v2-draft";

// ───────────────────────────── Local draft ─────────────────────────────

export function saveDraft(c: ViralCarousel): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch (err) {
    console.warn("[viral-sequence-v2] saveDraft failed:", err);
  }
}

export function loadDraft(): ViralCarousel | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViralCarousel;
    if (parsed.slides) parsed.slides = parsed.slides.map(migrateSlide);
    return parsed;
  } catch (err) {
    console.warn("[viral-sequence-v2] loadDraft failed:", err);
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ─────────────────────────── Supabase persist ──────────────────────────

export interface SavedCarouselSummary {
  id: string;
  title: string;
  status: string;
  template: string;
  updatedAt: string;
  slidesCount: number;
}

export async function listSavedCarousels(clientId: string): Promise<SavedCarouselSummary[]> {
  const { data, error } = await supabase
    .from("viral_carousels")
    .select("id, title, status, template, updated_at, slides")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    title: (r.title as string) ?? "Sem título",
    status: (r.status as string) ?? "draft",
    template: (r.template as string) ?? "twitter",
    updatedAt: r.updated_at as string,
    slidesCount: Array.isArray(r.slides) ? r.slides.length : 0,
  }));
}

export async function loadCarousel(id: string): Promise<ViralCarousel | null> {
  const { data, error } = await supabase
    .from("viral_carousels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const slides = Array.isArray((data as any).slides)
    ? ((data as any).slides as ViralCarousel["slides"])
    : [];
  return {
    id: (data as any).id as string,
    clientId: (data as any).client_id as string,
    workspaceId: (data as any).workspace_id as string,
    title: ((data as any).title as string) ?? "Carrossel",
    template: (((data as any).template as string) ?? "twitter") as ViralCarousel["template"],
    slides: slides.map(migrateSlide),
    profile: ((data as any).profile as ViralCarousel["profile"]) ?? { name: "", handle: "" },
    briefing: ((data as any).briefing as string) ?? undefined,
    tone: ((data as any).tone as string) ?? undefined,
    status: (((data as any).status as string) ?? "draft") as ViralCarousel["status"],
    createdAt: (data as any).created_at as string,
    updatedAt: (data as any).updated_at as string,
  };
}

export async function saveCarousel(
  carousel: ViralCarousel,
  context: { workspaceId: string; userId: string },
): Promise<ViralCarousel> {
  const { data: existing } = await supabase
    .from("viral_carousels")
    .select("id")
    .eq("id", carousel.id)
    .maybeSingle();

  const payload = {
    client_id: carousel.clientId,
    workspace_id: context.workspaceId,
    user_id: context.userId,
    title: carousel.title,
    briefing: carousel.briefing ?? null,
    tone: carousel.tone ?? null,
    template: carousel.template,
    profile: carousel.profile as unknown as never,
    slides: carousel.slides as unknown as never,
    status: carousel.status,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("viral_carousels")
      .update(payload)
      .eq("id", carousel.id)
      .select()
      .single();
    if (error) throw error;
    return { ...carousel, updatedAt: (data as any).updated_at as string };
  }
  const { data, error } = await supabase
    .from("viral_carousels")
    .insert({ ...payload, id: carousel.id })
    .select()
    .single();
  if (error) throw error;
  return {
    ...carousel,
    id: (data as any).id as string,
    createdAt: (data as any).created_at as string,
    updatedAt: (data as any).updated_at as string,
  };
}

export async function deleteCarousel(id: string): Promise<void> {
  const { error } = await supabase.from("viral_carousels").delete().eq("id", id);
  if (error) throw error;
}
