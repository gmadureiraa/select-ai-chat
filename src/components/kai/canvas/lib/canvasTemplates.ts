import type { CanvasTemplate } from "../CanvasToolbar";

export interface CanvasTemplateDef {
  id: CanvasTemplate;
  icon: string;
  label: string;
  description: string;
  name: string;
  nodes: any[];
  edges: any[];
}

// Single source of truth for templates (keep it small + polished)
export const CANVAS_TEMPLATES: CanvasTemplateDef[] = [
  {
    id: "carousel_from_url",
    icon: "🎠",
    label: "Carrossel IG",
    description: "Fonte → carrossel 7–10 slides",
    name: "Carrossel IG",
    nodes: [
      { id: "attachment-t1", type: "attachment", position: { x: 100, y: 150 }, data: { type: "attachment", activeTab: "link", url: "", files: [], images: [] } },
      { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Transforme este conteúdo em um carrossel de 7-10 slides para Instagram" } },
      { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } },
    ],
    edges: [
      { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
    ],
  },
  {
    id: "reel_script",
    icon: "🎬",
    label: "Roteiro Reels",
    description: "Gancho → cenas → CTA",
    name: "Roteiro Reels",
    nodes: [
      { id: "attachment-t1", type: "attachment", position: { x: 100, y: 180 }, data: { type: "attachment", activeTab: "text", textContent: "", files: [], images: [] } },
      { id: "prompt-t1", type: "prompt", position: { x: 100, y: 380 }, data: { type: "prompt", briefing: "Escreva um roteiro curto com HOOK, cenas, fala, indicação visual e CTA." } },
      { id: "generator-t1", type: "generator", position: { x: 450, y: 280 }, data: { type: "generator", format: "reel_script", platform: "instagram", isGenerating: false, quantity: 1 } },
    ],
    edges: [
      { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
    ],
  },
  {
    id: "thread_from_url",
    icon: "🧵",
    label: "Thread Twitter",
    description: "Fonte → thread 7–12 tweets",
    name: "Thread de URL",
    nodes: [
      { id: "attachment-t1", type: "attachment", position: { x: 100, y: 150 }, data: { type: "attachment", activeTab: "link", url: "", files: [], images: [] } },
      { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Crie uma thread com 7-12 tweets, cada um com até 280 caracteres, com progressão clara e CTA no final." } },
      { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
    ],
    edges: [
      { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
    ],
  },
  {
    id: "tweet_single",
    icon: "🐦",
    label: "Tweet único",
    description: "Um post curto (280 chars)",
    name: "Tweet (1 post)",
    nodes: [
      { id: "attachment-t1", type: "attachment", position: { x: 100, y: 150 }, data: { type: "attachment", activeTab: "text", textContent: "", files: [], images: [] } },
      { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Escreva 1 tweet (máx. 280 caracteres) com gancho forte, clareza e CTA leve." } },
      { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "post", platform: "twitter", isGenerating: false, quantity: 1 } },
    ],
    edges: [
      { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
    ],
  },
  {
    id: "linkedin_article",
    icon: "💼",
    label: "LinkedIn",
    description: "Post/artigo com insights",
    name: "Artigo LinkedIn",
    nodes: [
      { id: "attachment-t1", type: "attachment", position: { x: 100, y: 150 }, data: { type: "attachment", activeTab: "link", url: "", files: [], images: [] } },
      { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Transforme em um post para LinkedIn com clareza, autoridade e insights acionáveis. Inclua CTA profissional." } },
      { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "post", platform: "linkedin", isGenerating: false, quantity: 1 } },
    ],
    edges: [
      { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
    ],
  },
  {
    id: "newsletter_curated",
    icon: "📧",
    label: "Newsletter",
    description: "Compilar fontes em newsletter",
    name: "Newsletter Curada",
    nodes: [
      { id: "attachment-t1", type: "attachment", position: { x: 100, y: 120 }, data: { type: "attachment", activeTab: "link", url: "", files: [], images: [] } },
      { id: "attachment-t2", type: "attachment", position: { x: 100, y: 300 }, data: { type: "attachment", activeTab: "link", url: "", files: [], images: [] } },
      { id: "prompt-t1", type: "prompt", position: { x: 100, y: 500 }, data: { type: "prompt", briefing: "Compile estas fontes em uma newsletter com curadoria e análise. Inclua título, seções e CTA." } },
      { id: "generator-t1", type: "generator", position: { x: 450, y: 300 }, data: { type: "generator", format: "newsletter", platform: "other", isGenerating: false, quantity: 1 } },
    ],
    edges: [
      { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e2", source: "attachment-t2", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
      { id: "e3", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-3" },
    ],
  },
  {
    id: "creator_suite",
    icon: "✨",
    label: "Creator Suite",
    description: "1 fonte → 5 peças (IG/Reels/Twitter/LinkedIn/Newsletter)",
    name: "Creator Suite",
    nodes: [
      { id: "attachment-t1", type: "attachment", position: { x: 100, y: 220 }, data: { type: "attachment", activeTab: "link", url: "", files: [], images: [] } },
      { id: "prompt-t1", type: "prompt", position: { x: 100, y: 420 }, data: { type: "prompt", briefing: "Use a fonte como base e gere peças consistentes entre si (mesma tese/ângulo), variando apenas linguagem por canal." } },
      { id: "generator-carousel", type: "generator", position: { x: 520, y: 60 }, data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } },
      { id: "generator-reels", type: "generator", position: { x: 520, y: 220 }, data: { type: "generator", format: "reel_script", platform: "instagram", isGenerating: false, quantity: 1 } },
      { id: "generator-thread", type: "generator", position: { x: 520, y: 380 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
      { id: "generator-linkedin", type: "generator", position: { x: 520, y: 540 }, data: { type: "generator", format: "post", platform: "linkedin", isGenerating: false, quantity: 1 } },
      { id: "generator-newsletter", type: "generator", position: { x: 520, y: 700 }, data: { type: "generator", format: "newsletter", platform: "other", isGenerating: false, quantity: 1 } },
    ],
    edges: [
      { id: "e1", source: "attachment-t1", target: "generator-carousel", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e2", source: "attachment-t1", target: "generator-reels", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e3", source: "attachment-t1", target: "generator-thread", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e4", source: "attachment-t1", target: "generator-linkedin", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e5", source: "attachment-t1", target: "generator-newsletter", sourceHandle: "output", targetHandle: "input-1" },
      { id: "e6", source: "prompt-t1", target: "generator-carousel", sourceHandle: "output", targetHandle: "input-2" },
      { id: "e7", source: "prompt-t1", target: "generator-reels", sourceHandle: "output", targetHandle: "input-2" },
      { id: "e8", source: "prompt-t1", target: "generator-thread", sourceHandle: "output", targetHandle: "input-2" },
      { id: "e9", source: "prompt-t1", target: "generator-linkedin", sourceHandle: "output", targetHandle: "input-2" },
      { id: "e10", source: "prompt-t1", target: "generator-newsletter", sourceHandle: "output", targetHandle: "input-2" },
    ],
  },
];

export function getCanvasTemplate(id: CanvasTemplate): CanvasTemplateDef | undefined {
  return CANVAS_TEMPLATES.find((t) => t.id === id);
}

