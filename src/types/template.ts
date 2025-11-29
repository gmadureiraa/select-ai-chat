export interface TemplateRule {
  id: string;
  content: string;
}

export interface ClientTemplate {
  id: string;
  client_id: string;
  name: string;
  rules: TemplateRule[];
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  client_id: string;
  name: string;
  rules?: TemplateRule[];
}

export const DEFAULT_TEMPLATE_RULES: string[] = [
  "Sempre mantenha o tom de voz consistente com a marca",
  "Inclua call-to-action claro e direto",
  "Use linguagem acessível ao público-alvo",
  "Priorize clareza e objetividade",
];
