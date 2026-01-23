import type { ContentFormat, Platform } from "../hooks/useCanvasState";

export type ValidationSeverity = "info" | "warn" | "error";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
}

const PLATFORM_LIMITS: Record<Platform, number | null> = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  youtube: null,
  tiktok: 2200,
  other: null,
};

function splitByMarkers(text: string, markers: RegExp): string[] {
  return text
    .split(markers)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getBlocks(format: ContentFormat, platform: Platform, content: string): string[] {
  if (format === "carousel") {
    return splitByMarkers(
      content,
      /(?:\n---\n|\nSlide\s*\d+[:\s]*|\n📷\s*\d+[:\s]*)/i
    );
  }
  if (format === "thread") {
    return splitByMarkers(
      content,
      /(?:\nTweet\s*\d+[:\s]*|\n🧵\s*\d+[:\s]*|\n\d+\/\d+[:\s]*)/i
    );
  }
  // For twitter single tweet, treat as 1 block
  if (platform === "twitter") return [content];
  return [content];
}

export function validateContent(params: {
  format: ContentFormat;
  platform: Platform;
  content: string;
}): ValidationIssue[] {
  const { format, platform } = params;
  const content = (params.content || "").trim();
  const issues: ValidationIssue[] = [];

  if (!content) {
    issues.push({ severity: "error", code: "empty", message: "Conteúdo vazio." });
    return issues;
  }

  // Platform limit (simple)
  const limit = PLATFORM_LIMITS[platform];
  if (limit && content.length > limit) {
    issues.push({
      severity: "warn",
      code: "platform_limit",
      message: `Acima do limite do ${platform} (${content.length}/${limit} caracteres).`,
    });
  }

  const blocks = getBlocks(format, platform, content);

  if (format === "carousel") {
    const count = blocks.length;
    if (count < 7) {
      issues.push({ severity: "warn", code: "carousel_few_slides", message: `Carrossel com poucos slides (${count}). Recomendado: 7–10.` });
    } else if (count > 10) {
      issues.push({ severity: "warn", code: "carousel_many_slides", message: `Carrossel com muitos slides (${count}). Recomendado: 7–10.` });
    }
  }

  if (format === "thread" || platform === "twitter") {
    const tweets = format === "thread" ? blocks : [content];
    const over = tweets
      .map((t, i) => ({ i: i + 1, len: t.length }))
      .filter((x) => x.len > 280);
    if (over.length) {
      issues.push({
        severity: "error",
        code: "tweet_over_280",
        message: `Há ${over.length} tweet(s) acima de 280 caracteres (ex.: #${over[0].i} com ${over[0].len}).`,
      });
    }
  }

  if (format === "reel_script") {
    const hasHook = /(^|\n)\s*(hook|gancho)\s*[:\-]/i.test(content);
    const hasCTA = /(^|\n)\s*(cta|call to action)\s*[:\-]/i.test(content) || /\bcomente\b|\bsiga\b|\bclique\b/i.test(content);
    if (!hasHook) issues.push({ severity: "info", code: "reels_missing_hook", message: "Sugestão: adicionar um HOOK/GANCHO no início." });
    if (!hasCTA) issues.push({ severity: "info", code: "reels_missing_cta", message: "Sugestão: adicionar CTA (comente/siga/salve/compartilhe)." });
  }

  if (format === "newsletter") {
    const hasSubject = /\bassunto\b/i.test(content) || /^#\s+/m.test(content);
    if (!hasSubject) issues.push({ severity: "info", code: "newsletter_subject", message: "Sugestão: incluir Assunto/Headline." });
    if (content.split(/\s+/).length < 250) issues.push({ severity: "info", code: "newsletter_short", message: "Sugestão: newsletter está curta; considere adicionar mais seções/contexto." });
  }

  if (platform === "linkedin") {
    if (content.length < 600) issues.push({ severity: "info", code: "linkedin_length", message: "Sugestão: LinkedIn performa melhor com texto mais completo (ex.: 600+ chars) ou estrutura de artigo." });
  }

  return issues;
}

