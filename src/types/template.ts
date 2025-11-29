export interface TemplateRule {
  id: string;
  content: string;
}

export interface ClientTemplate {
  id: string;
  client_id: string;
  name: string;
  type: 'chat' | 'image';
  rules: TemplateRule[];
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  client_id: string;
  name: string;
  type: 'chat' | 'image';
  rules?: TemplateRule[];
}

export const DEFAULT_CHAT_RULES: string[] = [
  "Sempre mantenha o tom de voz consistente com a marca",
  "Inclua call-to-action claro e direto",
  "Use linguagem acessível ao público-alvo",
  "Priorize clareza e objetividade",
];

export const DEFAULT_IMAGE_RULES: string[] = [
  "Estilo: Moderno e minimalista",
  "Proporção: 1024x1024 (quadrado)",
  "Paleta de cores: Vibrante com acentos neon e magenta",
  "Qualidade: Alta (high quality)",
  "Contexto: Sempre incluir elementos da marca quando possível",
];
