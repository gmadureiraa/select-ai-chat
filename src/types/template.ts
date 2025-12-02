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

// Regras globais de formato
export const GLOBAL_CONTENT_RULES = {
  emoji: "EVITE emojis a menos que seja extremamente necessário. NUNCA use emojis no meio de frases ou de forma desnecessária.",
};

// Regras específicas para Stories
export const STORIES_FORMAT_RULES = `
## 📱 FORMATO OBRIGATÓRIO PARA STORIES

**SEMPRE estruture stories seguindo este formato:**

Ideia do storie: 
[Descreva brevemente a ideia geral da sequência]

Sequência:

Story 1:
[Ideia de design - descreva elementos visuais, cores, composição]
Texto: [texto que aparece no story]
[Ideia de imagem se existir - descreva a imagem ou elemento visual principal]

Story 2:
[Ideia de design]
Texto: [texto do story 2]
[Ideia de imagem se existir]

[Continue para todos os stories da sequência...]

**IMPORTANTE:** 
- Apresente PRIMEIRO a ideia geral
- Cada story deve ter design, texto e sugestão visual clara
- Mantenha sequência lógica e coerente
`;

// Regras específicas para Carrossel
export const CAROUSEL_FORMAT_RULES = `
## 🎴 FORMATO OBRIGATÓRIO PARA CARROSSEL

**SEMPRE estruture carrosséis seguindo este formato:**

Ideia do carrossel:
[Descreva brevemente a ideia geral e objetivo do carrossel]

Sequência:

Página 1 (Hook):
[Ideia de design - descreva layout, cores, hierarquia visual]
Título: [título chamativo]
Texto: [2-3 opções fortes que chamem atenção]
[Ideia de imagem se existir]

Página 2:
[Ideia de design]
Título/Texto: [desenvolvimento - uma ideia por página]
[Ideia de imagem se existir]

[Continue para páginas intermediárias...]

Última Página (CTA):
[Ideia de design]
Texto: [CTA clara e direta - curtir, seguir OU salvar]
[Ideia de imagem se existir]

**ESTRUTURA OBRIGATÓRIA:**
- Página 1: Hook com 2-3 opções chamativas
- Páginas intermediárias: Um conceito por página
- Última página: CTA única conectada ao hook inicial
`;

// Detecção de pedido de ideias
export const IDEA_REQUEST_KEYWORDS = [
  "ideias", "ideia", "sugestões", "sugestão", "me dá", "me de",
  "quero ideias", "preciso de ideias", "pode sugerir", "sugira"
];
