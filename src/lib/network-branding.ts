// network-branding.ts — fonte única de verdade da estética visual de cada
// rede social no KAI 2.0. Centraliza icon, cores, gradientes, hex (recharts),
// metric primária e features (reels/stories/etc).
//
// Uso:
//   import { getNetworkBranding } from "@/lib/network-branding";
//   const b = getNetworkBranding("instagram");
//   <div className={cn(b.bgGradient, "...")}>
//     <b.icon className={b.iconClass} />
//     ...
//   </div>
//   <Area stroke={b.primaryHex} />
//
// Adicionar nova rede: criar entrada no NETWORK_BRANDING e o resto do app
// herda automático (TabsTrigger, cards, charts, badges).

import {
  AtSign,
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  Twitter,
  Youtube,
  type LucideIcon,
  Image as PinIcon,
  Cloud,
} from "lucide-react";

export type NetworkId =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "threads"
  | "pinterest"
  | "bluesky";

export type PrimaryMetric = "likes" | "reach" | "views" | "impressions";

export interface NetworkBranding {
  id: NetworkId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;

  // Tailwind classes
  /** Gradient/cor sólida cheia (uso em botão, badge avatar, header colorido). */
  bgGradient: string;
  /** Cor sólida (variante simples sem gradient — chip pequeno). */
  bgSolid: string;
  /** Cor sólida em hex puro pra recharts/SVG. */
  primaryHex: string;
  /** Cor secundária (gradient-end ou tom auxiliar). */
  secondaryHex: string;
  /** Texto / ícone na cor da rede (accents). */
  textColor: string;
  /** Borda colorida sutil (cards highlight). */
  borderColor: string;
  /** Background sutil pra accent cards (tab ativa, KPI highlight). */
  accentBg: string;
  /** Ring/focus da rede. */
  ringColor: string;
  /** Cor do ícone quando rendered ON the colored bg (preto pra X, branco pra resto). */
  iconOnBgClass: string;

  // Métricas / features
  primaryMetric: PrimaryMetric;
  hasReels: boolean;
  hasStories: boolean;
  hasCarousel: boolean;
  hasThreads: boolean;
  hasShorts: boolean;
}

/**
 * Branding canônico das 9 redes suportadas.
 * Cores em alinhamento aos brand guidelines oficiais (Instagram gradient, X
 * preto, LinkedIn #0A66C2, TikTok rosa+ciano, YouTube vermelho, etc).
 */
export const NETWORK_BRANDING: Record<NetworkId, NetworkBranding> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    shortLabel: "IG",
    icon: Instagram,
    bgGradient:
      "bg-gradient-to-tr from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
    bgSolid: "bg-[#E1306C]",
    primaryHex: "#E1306C",
    secondaryHex: "#F77737",
    textColor: "text-[#E1306C]",
    borderColor: "border-[#E1306C]/30",
    accentBg: "bg-[#E1306C]/5",
    ringColor: "ring-[#E1306C]/40",
    iconOnBgClass: "text-white",
    primaryMetric: "reach",
    hasReels: true,
    hasStories: true,
    hasCarousel: true,
    hasThreads: false,
    hasShorts: false,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    shortLabel: "FB",
    icon: Facebook,
    bgGradient: "bg-gradient-to-br from-[#1877F2] to-[#0a5ec9]",
    bgSolid: "bg-[#1877F2]",
    primaryHex: "#1877F2",
    secondaryHex: "#0a5ec9",
    textColor: "text-[#1877F2]",
    borderColor: "border-[#1877F2]/30",
    accentBg: "bg-[#1877F2]/5",
    ringColor: "ring-[#1877F2]/40",
    iconOnBgClass: "text-white",
    primaryMetric: "reach",
    hasReels: true,
    hasStories: true,
    hasCarousel: false,
    hasThreads: false,
    hasShorts: false,
  },
  twitter: {
    id: "twitter",
    label: "X / Twitter",
    shortLabel: "X",
    icon: Twitter,
    // X é literal preto puro com tipografia branca — sem gradient
    bgGradient: "bg-black",
    bgSolid: "bg-black",
    primaryHex: "#000000",
    secondaryHex: "#1d1d1f",
    textColor: "text-foreground",
    borderColor: "border-foreground/30",
    accentBg: "bg-foreground/5",
    ringColor: "ring-foreground/40",
    iconOnBgClass: "text-white",
    primaryMetric: "impressions",
    hasReels: false,
    hasStories: false,
    hasCarousel: false,
    hasThreads: true,
    hasShorts: false,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    shortLabel: "LI",
    icon: Linkedin,
    bgGradient: "bg-gradient-to-br from-[#0A66C2] to-[#004182]",
    bgSolid: "bg-[#0A66C2]",
    primaryHex: "#0A66C2",
    secondaryHex: "#004182",
    textColor: "text-[#0A66C2]",
    borderColor: "border-[#0A66C2]/30",
    accentBg: "bg-[#0A66C2]/5",
    ringColor: "ring-[#0A66C2]/40",
    iconOnBgClass: "text-white",
    primaryMetric: "impressions",
    hasReels: false,
    hasStories: false,
    hasCarousel: true,
    hasThreads: false,
    hasShorts: false,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    shortLabel: "TT",
    icon: Music2,
    // TikTok glitch — preto base com accent rosa+ciano (vermelho rosa #FE2C55, ciano #25F4EE)
    bgGradient: "bg-gradient-to-br from-[#25F4EE] via-black to-[#FE2C55]",
    bgSolid: "bg-black",
    primaryHex: "#FE2C55",
    secondaryHex: "#25F4EE",
    textColor: "text-[#FE2C55]",
    borderColor: "border-[#FE2C55]/30",
    accentBg: "bg-[#FE2C55]/5",
    ringColor: "ring-[#FE2C55]/40",
    iconOnBgClass: "text-white",
    primaryMetric: "views",
    hasReels: false,
    hasStories: false,
    hasCarousel: false,
    hasThreads: false,
    hasShorts: false,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    shortLabel: "YT",
    icon: Youtube,
    bgGradient: "bg-gradient-to-br from-[#FF0000] to-[#cc0000]",
    bgSolid: "bg-[#FF0000]",
    primaryHex: "#FF0000",
    secondaryHex: "#cc0000",
    textColor: "text-[#FF0000]",
    borderColor: "border-[#FF0000]/30",
    accentBg: "bg-[#FF0000]/5",
    ringColor: "ring-[#FF0000]/40",
    iconOnBgClass: "text-white",
    primaryMetric: "views",
    hasReels: false,
    hasStories: false,
    hasCarousel: false,
    hasThreads: false,
    hasShorts: true,
  },
  threads: {
    id: "threads",
    label: "Threads",
    shortLabel: "Threads",
    icon: AtSign,
    bgGradient: "bg-gradient-to-br from-zinc-900 to-black",
    bgSolid: "bg-black",
    primaryHex: "#101010",
    secondaryHex: "#404040",
    textColor: "text-foreground",
    borderColor: "border-foreground/30",
    accentBg: "bg-foreground/5",
    ringColor: "ring-foreground/40",
    iconOnBgClass: "text-white",
    primaryMetric: "impressions",
    hasReels: false,
    hasStories: false,
    hasCarousel: false,
    hasThreads: true,
    hasShorts: false,
  },
  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    shortLabel: "Pin",
    icon: PinIcon,
    bgGradient: "bg-gradient-to-br from-[#E60023] to-[#ad001a]",
    bgSolid: "bg-[#E60023]",
    primaryHex: "#E60023",
    secondaryHex: "#ad001a",
    textColor: "text-[#E60023]",
    borderColor: "border-[#E60023]/30",
    accentBg: "bg-[#E60023]/5",
    ringColor: "ring-[#E60023]/40",
    iconOnBgClass: "text-white",
    primaryMetric: "impressions",
    hasReels: false,
    hasStories: false,
    hasCarousel: false,
    hasThreads: false,
    hasShorts: false,
  },
  bluesky: {
    id: "bluesky",
    label: "Bluesky",
    shortLabel: "Bsky",
    icon: Cloud,
    bgGradient: "bg-gradient-to-br from-[#1185FE] to-[#0066cc]",
    bgSolid: "bg-[#1185FE]",
    primaryHex: "#1185FE",
    secondaryHex: "#0066cc",
    textColor: "text-[#1185FE]",
    borderColor: "border-[#1185FE]/30",
    accentBg: "bg-[#1185FE]/5",
    ringColor: "ring-[#1185FE]/40",
    iconOnBgClass: "text-white",
    primaryMetric: "impressions",
    hasReels: false,
    hasStories: false,
    hasCarousel: false,
    hasThreads: true,
    hasShorts: false,
  },
};

/**
 * Lookup tolerante: aceita qualquer string e cai pro instagram default
 * (em vez de quebrar a UI). Não loga warning pra não poluir console em
 * canais arquivados (twitter pode virar X internamente etc).
 */
export function getNetworkBranding(network: string | undefined | null): NetworkBranding {
  if (!network) return NETWORK_BRANDING.instagram;
  const key = String(network).toLowerCase().trim();
  // Aliases comuns
  if (key === "x" || key === "twitter" || key === "x.com" || key === "twitter.com") {
    return NETWORK_BRANDING.twitter;
  }
  if (key === "ig") return NETWORK_BRANDING.instagram;
  if (key === "fb") return NETWORK_BRANDING.facebook;
  if (key === "li") return NETWORK_BRANDING.linkedin;
  if (key === "yt") return NETWORK_BRANDING.youtube;
  if (key === "tt") return NETWORK_BRANDING.tiktok;
  return NETWORK_BRANDING[key as NetworkId] ?? NETWORK_BRANDING.instagram;
}

/** Lista ordenada na ordem default de exibição (mesmo padrão do MetricoolPerformance). */
export const NETWORK_DISPLAY_ORDER: NetworkId[] = [
  "instagram",
  "twitter",
  "threads",
  "linkedin",
  "tiktok",
  "youtube",
  "facebook",
  "pinterest",
  "bluesky",
];

/** Apenas as redes principais (sem pinterest/bluesky) — usado em performance/clientes. */
export const CORE_NETWORKS: NetworkId[] = [
  "instagram",
  "twitter",
  "threads",
  "linkedin",
  "tiktok",
  "youtube",
  "facebook",
];
