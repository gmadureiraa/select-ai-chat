// Types for the Multi-Agent Orchestrator System

export type SpecializedAgentType = 
  | "content_writer"     // Geração de textos e copy
  | "design_agent"       // Geração de imagens com brand assets
  | "metrics_analyst"    // Análise de dados de performance
  | "email_developer"    // Templates HTML de email
  | "researcher"         // Pesquisa e análise de mercado
  | "strategist";        // Planejamento estratégico

export interface OrchestratorDecision {
  shouldUseOrchestrator: boolean;
  complexity: "simple" | "medium" | "complex";
  selectedAgents: SpecializedAgentType[];
  executionPlan: ExecutionPlanStep[];
  reasoning: string;
  estimatedDuration: number;
}

export interface ExecutionPlanStep {
  id: string;
  agentType: SpecializedAgentType;
  name: string;
  description: string;
  dependencies: string[]; // IDs of steps that must complete first
  expectedOutput: string;
  tools: string[];
}

export interface AgentExecution {
  stepId: string;
  agentType: SpecializedAgentType;
  status: "pending" | "running" | "completed" | "error";
  input?: Record<string, any>;
  output?: string;
  intermediateOutputs?: string[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface OrchestrationState {
  isActive: boolean;
  isPaused: boolean;
  plan: OrchestratorDecision | null;
  executions: AgentExecution[];
  currentStepId: string | null;
  finalOutput: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// Agent definitions for the orchestrator
export interface SpecializedAgent {
  type: SpecializedAgentType;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  requiredData: string[];
  model: "flash" | "pro" | "flash-lite";
}

export const SPECIALIZED_AGENTS: Record<SpecializedAgentType, SpecializedAgent> = {
  content_writer: {
    type: "content_writer",
    name: "Escritor de Conteúdo",
    description: "Especialista em criar textos, posts, newsletters e copy",
    icon: "PenTool",
    capabilities: [
      "Criação de posts para redes sociais",
      "Escrita de newsletters",
      "Copy para anúncios",
      "Artigos e blog posts",
      "Scripts de vídeo"
    ],
    requiredData: ["identity_guide", "content_library", "copywriting_guide"],
    model: "pro"
  },
  design_agent: {
    type: "design_agent",
    name: "Designer Visual",
    description: "Cria imagens usando brand assets e referências visuais",
    icon: "Palette",
    capabilities: [
      "Geração de imagens com IA",
      "Aplicação de brand guidelines",
      "Criação de thumbnails",
      "Banners e covers",
      "Carrosséis visuais"
    ],
    requiredData: ["brand_assets", "visual_references"],
    model: "flash"
  },
  metrics_analyst: {
    type: "metrics_analyst",
    name: "Analista de Métricas",
    description: "Analisa dados de performance e gera insights",
    icon: "BarChart3",
    capabilities: [
      "Análise de engajamento",
      "Comparação de períodos",
      "Identificação de tendências",
      "Relatórios de performance",
      "Recomendações baseadas em dados"
    ],
    requiredData: ["platform_metrics", "performance_goals"],
    model: "flash"
  },
  email_developer: {
    type: "email_developer",
    name: "Desenvolvedor de Email",
    description: "Cria templates HTML responsivos para email marketing",
    icon: "Mail",
    capabilities: [
      "Templates HTML responsivos",
      "Layouts para newsletters",
      "Emails promocionais",
      "Sequências de automação",
      "Preview e teste"
    ],
    requiredData: ["brand_assets", "email_templates"],
    model: "pro"
  },
  researcher: {
    type: "researcher",
    name: "Pesquisador",
    description: "Pesquisa mercado, tendências e referências",
    icon: "Search",
    capabilities: [
      "Pesquisa de mercado",
      "Análise de concorrência",
      "Curadoria de referências",
      "Tendências do setor",
      "Benchmarking"
    ],
    requiredData: ["reference_library", "global_knowledge"],
    model: "flash"
  },
  strategist: {
    type: "strategist",
    name: "Estrategista",
    description: "Planeja campanhas e estratégias de conteúdo",
    icon: "Lightbulb",
    capabilities: [
      "Planejamento de campanha",
      "Calendário editorial",
      "Estratégia de conteúdo",
      "Definição de KPIs",
      "Roadmap de execução"
    ],
    requiredData: ["identity_guide", "performance_goals", "content_library"],
    model: "pro"
  }
};

// Patterns to detect which agents to use
export const REQUEST_PATTERNS: Record<SpecializedAgentType, RegExp[]> = {
  content_writer: [
    /cri(e|ar)\s+(um|uma|o|a)?\s*(post|tweet|thread|newsletter|artigo|texto|copy|legenda|caption)/i,
    /escrev(a|er)\s+(um|uma|o|a)?\s*(post|tweet|thread|newsletter|artigo|texto|copy)/i,
    /fa(ça|zer)\s+(um|uma|o|a)?\s*(post|tweet|thread|newsletter|artigo|texto|copy)/i,
    /gerar?\s+(um|uma)?\s*(conteúdo|copy|texto)/i,
  ],
  design_agent: [
    /cri(e|ar)\s+(uma?)?\s*(imagem|arte|visual|banner|thumbnail|capa|cover)/i,
    /ger(e|ar)\s+(uma?)?\s*(imagem|arte|visual|banner|thumbnail)/i,
    /design(ar|e)?\s+(uma?)?\s*(imagem|arte|visual|banner)/i,
    /fa(ça|zer)\s+(uma?)?\s*(imagem|arte|visual|banner|thumbnail)/i,
  ],
  metrics_analyst: [
    /analis(e|ar)\s+(as?)?\s*(métrica|performance|dado|resultado|engajamento)/i,
    /como\s+(está|estão|foi|foram)\s+(o|a|os|as)?\s*(resultado|número|métrica|performance)/i,
    /relatório\s+de\s+(performance|métrica|resultado)/i,
    /qual\s+(foi|é)\s+(o|a)?\s*(melhor|pior|top)/i,
    /insight|tendência|crescimento|queda/i,
  ],
  email_developer: [
    /cri(e|ar)\s+(um?)?\s*(email|e-mail|template\s+de\s+email)/i,
    /template\s+(html|de\s+email|newsletter)/i,
    /email\s+(marketing|promocional|automação)/i,
  ],
  researcher: [
    /pesquis(e|ar)\s+(sobre|o|a|os|as)?/i,
    /busca(r|e)\s+(sobre|informações|referências)/i,
    /encontr(e|ar)\s+(referências|exemplos|inspiração)/i,
    /o\s+que\s+(é|são|significa)/i,
  ],
  strategist: [
    /plano\s+de\s+(campanha|conteúdo|marketing)/i,
    /estratégia\s+(de|para)/i,
    /calendário\s+(editorial|de\s+conteúdo)/i,
    /planej(e|ar|amento)/i,
    /defin(ir|a)\s+(kpi|meta|objetivo)/i,
  ]
};

// Helper to detect request complexity
export function detectRequestComplexity(message: string): "simple" | "medium" | "complex" {
  const words = message.split(/\s+/).length;
  const hasMultipleRequests = /\be\b.*\be\b|,.*,/.test(message);
  const hasComplexKeywords = /(campanha|estratégia|plano|análise\s+completa|relatório)/i.test(message);
  
  if (hasMultipleRequests || hasComplexKeywords || words > 50) {
    return "complex";
  }
  if (words > 20 || /além\s+disso|também|inclua/i.test(message)) {
    return "medium";
  }
  return "simple";
}

// Helper to detect which agents are needed
export function detectRequiredAgents(message: string): SpecializedAgentType[] {
  const detectedAgents: SpecializedAgentType[] = [];
  
  for (const [agentType, patterns] of Object.entries(REQUEST_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(message))) {
      detectedAgents.push(agentType as SpecializedAgentType);
    }
  }
  
  // Default to content_writer if no specific agent detected
  if (detectedAgents.length === 0) {
    detectedAgents.push("content_writer");
  }
  
  return detectedAgents;
}
