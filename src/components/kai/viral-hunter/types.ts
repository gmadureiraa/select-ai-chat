/**
 * Tipos compartilhados entre as sub-tabs do Viral Hunter.
 */

export type ViralHunterTabId =
  | "overview"
  | "competitors"
  | "youtube"
  | "news"
  | "trends"
  | "ideas";

export interface CompetitorEntry {
  platform: "instagram" | "twitter" | "linkedin" | "youtube" | "tiktok" | "website";
  handle: string; // @user ou channel id ou URL
  notes?: string;
  addedAt: string;
}

/** Armazenado em client.tags.viral_hunter como JSON string. */
export interface ViralHunterConfig {
  keywords: string[]; // termos do nicho, ex: ["bitcoin", "defi", "self-custody"]
  competitors: CompetitorEntry[];
  yt_channels?: string[]; // channel IDs do YouTube pra monitorar
}

export function parseViralHunterConfig(raw: string | undefined | null): ViralHunterConfig {
  if (!raw) return { keywords: [], competitors: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      yt_channels: Array.isArray(parsed.yt_channels) ? parsed.yt_channels : undefined,
    };
  } catch {
    return { keywords: [], competitors: [] };
  }
}

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnailUrl: string;
  publishedAt: string;
  description: string;
  url: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  snippet?: string;
  thumbnailUrl?: string;
}
