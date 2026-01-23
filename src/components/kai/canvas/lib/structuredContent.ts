import type { ContentFormat, Platform } from "../hooks/useCanvasState";

export type StructuredKind =
  | "carousel"
  | "thread"
  | "reel_script"
  | "newsletter"
  | "linkedin_article"
  | "text";

export interface StructuredContent {
  kind: StructuredKind;
  blocks: string[];
}

function splitByMarkers(text: string, markers: RegExp): string[] {
  return text
    .split(markers)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseStructuredContent(params: {
  format: ContentFormat;
  platform: Platform;
  text: string;
}): StructuredContent {
  const { format, platform } = params;
  const text = (params.text || "").trim();

  if (!text) return { kind: "text", blocks: [""] };

  if (format === "carousel") {
    // Common separators: --- , Slide 1, 📷 1
    const blocks = splitByMarkers(
      text,
      /(?:\n---\n|\nSlide\s*\d+[:\s]*|\n📷\s*\d+[:\s]*)/i
    );
    return { kind: "carousel", blocks: blocks.length ? blocks : [text] };
  }

  if (format === "thread") {
    // Common separators: Tweet 1, 🧵 1, 1/10
    const blocks = splitByMarkers(
      text,
      /(?:\nTweet\s*\d+[:\s]*|\n🧵\s*\d+[:\s]*|\n\d+\/\d+[:\s]*)/i
    );
    return { kind: "thread", blocks: blocks.length ? blocks : [text] };
  }

  if (format === "reel_script") {
    // Keep it simple: sections split by headings like HOOK:, CENA, CTA, etc.
    const blocks = splitByMarkers(
      text,
      /(?:\n(?=(?:hook|gancho|cena|scene|cta|call to action)\b[:\s]))/i
    );
    return { kind: "reel_script", blocks: blocks.length ? blocks : [text] };
  }

  if (format === "newsletter") {
    // Split by markdown headings (##) to allow editing by sections
    const blocks = splitByMarkers(text, /(?:\n##\s+)/g);
    return { kind: "newsletter", blocks: blocks.length ? blocks : [text] };
  }

  // LinkedIn article: treat linkedin posts with headings as article-like
  if (platform === "linkedin" && (text.includes("\n# ") || text.startsWith("# "))) {
    const blocks = splitByMarkers(text, /(?:\n##\s+)/g);
    return { kind: "linkedin_article", blocks: blocks.length ? blocks : [text] };
  }

  return { kind: "text", blocks: [text] };
}

export function serializeStructuredContent(structured: StructuredContent): string {
  const blocks = structured.blocks.map((b) => (b ?? "").trim()).filter(Boolean);
  if (blocks.length === 0) return "";

  switch (structured.kind) {
    case "carousel":
      return blocks.map((b, i) => `Slide ${i + 1}:\n${b}`).join("\n\n---\n\n");
    case "thread":
      return blocks.map((b, i) => `Tweet ${i + 1}:\n${b}`).join("\n\n");
    case "reel_script":
      return blocks.join("\n\n");
    case "newsletter":
      // Keep first block as-is, subsequent blocks as ## headings sections
      if (blocks.length === 1) return blocks[0];
      return [blocks[0], ...blocks.slice(1).map((b) => `## ${b}`)].join("\n\n");
    case "linkedin_article":
      if (blocks.length === 1) return blocks[0];
      return [blocks[0], ...blocks.slice(1).map((b) => `## ${b}`)].join("\n\n");
    case "text":
    default:
      return blocks.join("\n\n");
  }
}

