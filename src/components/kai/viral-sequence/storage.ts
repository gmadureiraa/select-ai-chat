/**
 * Storage da Sequência Viral.
 *
 * - Rascunho atual em sessionStorage (autosave, sobrevive a refresh).
 * - Carrosséis salvos no Supabase (`viral_carousels`) — persistem entre
 *   dispositivos e sessões, com RLS por workspace.
 *
 * API:
 *   saveDraft(c)         — autosave do rascunho em edição (local)
 *   loadDraft()          — retomar rascunho após refresh (local)
 *   clearDraft()         — descartar rascunho local
 *   listSavedCarousels(clientId) — lista carrosséis salvos do cliente
 *   saveCarousel(c, workspaceId, userId) — upsert no Supabase
 *   deleteCarousel(id)   — remove do Supabase
 *   loadCarousel(id)     — busca um carrossel específico do Supabase
 *
 * Aliases legados (saveCurrentCarousel/loadCurrentCarousel/clearCurrentCarousel)
 * são re-exports pra não quebrar imports existentes enquanto migramos.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ViralCarousel } from "./types";
import { migrateSlide } from "./types";

const STORAGE_KEY = "kai-viral-sequence-draft";

// ---------- Local draft (sessionStorage) ----------

export function saveDraft(c: ViralCarousel): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch (err) {
    console.warn("[viral-sequence] saveDraft failed:", err);
  }
}

export function loadDraft(): ViralCarousel | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViralCarousel;
    if (parsed.slides) {
      parsed.slides = parsed.slides.map(migrateSlide);
    }
    return parsed;
  } catch (err) {
    console.warn("[viral-sequence] loadDraft failed:", err);
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[viral-sequence] clearDraft failed:", err);
  }
}

// Backwards-compat aliases
export const saveCurrentCarousel = saveDraft;
export const loadCurrentCarousel = loadDraft;
export const clearCurrentCarousel = clearDraft;

// ---------- Persistent storage (Supabase) ----------

export interface SavedCarouselSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  slidesCount: number;
}

export async function listSavedCarousels(clientId: string): Promise<SavedCarouselSummary[]> {
  const { data, error } = await supabase
    .from("viral_carousels")
    .select("id, title, status, updated_at, slides")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? "Sem título",
    status: (r.status as string) ?? "draft",
    updatedAt: r.updated_at as string,
    slidesCount: Array.isArray(r.slides) ? (r.slides as unknown[]).length : 0,
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

  const slides = Array.isArray(data.slides)
    ? (data.slides as unknown as ViralCarousel["slides"])
    : [];
  return {
    id: data.id as string,
    clientId: data.client_id as string,
    title: (data.title as string) ?? "Carrossel",
    template: ((data.template as string) ?? "twitter") as ViralCarousel["template"],
    slides: slides.map(migrateSlide),
    profile: (data.profile as unknown as ViralCarousel["profile"]) ?? { name: "", handle: "" },
    briefing: (data.briefing as string) ?? undefined,
    status: ((data.status as string) ?? "draft") as ViralCarousel["status"],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
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
    return { ...carousel, updatedAt: data.updated_at as string };
  } else {
    const { data, error } = await supabase
      .from("viral_carousels")
      .insert({ ...payload, id: carousel.id })
      .select()
      .single();
    if (error) throw error;
    return {
      ...carousel,
      id: data.id as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

export async function deleteCarousel(id: string): Promise<void> {
  const { error } = await supabase.from("viral_carousels").delete().eq("id", id);
  if (error) throw error;
}
