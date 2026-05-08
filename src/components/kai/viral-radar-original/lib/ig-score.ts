/**
 * Viral score IG — cópia do standalone (`lib/ig-score.ts`).
 */

import type { InstagramPostRow } from "../types";

export function igPostScore(post: InstagramPostRow): number {
  const likes = post.likes ?? 0;
  if (likes <= 0) return 0;
  const base = Math.log10(likes + 1) * 100;

  // Freshness boost
  let freshBoost = 1;
  if (post.posted_at) {
    const ageH = (Date.now() - new Date(post.posted_at).getTime()) / 3_600_000;
    if (ageH < 48) freshBoost = 1.5 - (ageH / 48) * 0.3;
    else if (ageH < 168) freshBoost = 1.2 - ((ageH - 48) / 120) * 0.2;
  }

  const isCarousel = (post.child_urls?.length ?? 0) > 1;
  const carouselBoost = isCarousel ? 1.2 : 1;

  return Math.min(999, Math.round(base * freshBoost * carouselBoost));
}

export function igScoreTier(score: number): { label: string; color: string } {
  if (score >= 400) return { label: "Viral", color: "#FF3D2E" };
  if (score >= 250) return { label: "Pegando", color: "#F0B33C" };
  if (score >= 100) return { label: "Forte", color: "#7CB342" };
  return { label: "Normal", color: "#888" };
}
