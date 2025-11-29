export interface TemplateRule {
  id: string;
  content: string;
  type?: 'text' | 'image_reference' | 'content_reference';
  file_url?: string; // For image references or content files
}

export interface ClientTemplate {
  id: string;
  client_id: string;
  name: string;
  type: 'chat' | 'image' | 'automation';
  rules: TemplateRule[];
  automation_config?: AutomationConfig;
  created_at: string;
  updated_at: string;
}

export interface AutomationConfig {
  schedule_type: string;
  schedule_time?: string;
  schedule_days?: string[];
  schedule_config?: any;
  model: string;
  prompt: string;
  data_sources?: any[];
  actions?: any[];
  email_recipients?: string[];
  webhook_url?: string;
}

export interface CreateTemplateData {
  client_id: string;
  name: string;
  type: 'chat' | 'image' | 'automation';
  rules?: TemplateRule[];
  automation_config?: AutomationConfig;
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
