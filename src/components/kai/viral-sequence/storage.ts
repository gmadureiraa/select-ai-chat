/**
 * Storage stub da Sequência Viral.
 *
 * Por ora persiste o carrossel ATUAL (em edição) em sessionStorage pra
 * sobreviver a refresh. NÃO persiste histórico de carrosséis salvos —
 * isso fica pro Lovable plugar depois, contra o Supabase próprio do
 * Sequência Viral (projeto diferente do KAI).
 *
 * A interface abaixo é o contrato que o Lovable deve implementar pra
 * substituir esse stub por persistência real:
 *
 *   saveCurrentCarousel(c)  — autosave do carrossel em edição
 *   loadCurrentCarousel()   — retomar edição após refresh
 *   clearCurrentCarousel()  — descartar rascunho
 *
 * TODO(lovable): substituir por insert/update na tabela `carousels`
 * do projeto Supabase do sequencia-viral (postflow). Schema já existe:
 *   carousels(id, user_id, title, slides jsonb, style jsonb, status, ...)
 */

import type { ViralCarousel } from "./types";
import { migrateSlide } from "./types";

const STORAGE_KEY = "kai-viral-sequence-draft";

export function saveCurrentCarousel(c: ViralCarousel): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch (err) {
    console.warn("[viral-sequence] saveCurrentCarousel failed:", err);
  }
}

export function loadCurrentCarousel(): ViralCarousel | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViralCarousel;
    // Migração: rascunhos antigos com heading+body separados. Concatena
    // heading como **bold** no começo do body.
    if (parsed.slides) {
      parsed.slides = parsed.slides.map(migrateSlide);
    }
    return parsed;
  } catch (err) {
    console.warn("[viral-sequence] loadCurrentCarousel failed:", err);
    return null;
  }
}

export function clearCurrentCarousel(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[viral-sequence] clearCurrentCarousel failed:", err);
  }
}
