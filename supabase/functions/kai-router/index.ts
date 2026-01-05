import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RouterRequest {
  message: string;
  clientId?: string;
  hasFiles?: boolean;
  fileTypes?: string[];
}

interface RoutingDecision {
  pipeline: "multi_agent_content" | "metrics_analysis" | "free_chat";
  agent: "metrics" | "content" | "planning" | "general";
  confidence: number;
  reason: string;
  extractedParams: {
    format?: string;
    period?: string;
    quantity?: number;
    platform?: string;
    action?: string;
    contentType?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, clientId, hasFiles, fileTypes } = await req.json() as RouterRequest;
    const lowerMessage = message.toLowerCase();

    // Rule-based routing for speed and accuracy
    let decision: RoutingDecision;

    // Metrics patterns
    const metricsPatterns = [
      /métricas?/i,
      /seguidores?/i,
      /engajamento/i,
      /performance/i,
      /desempenho/i,
      /curtidas?|likes?/i,
      /comentários?/i,
      /alcance/i,
      /impressões?/i,
      /crescimento/i,
      /views?|visualizações?/i,
      /como est[áa]/i,
      /quantos?/i,
      /resultado/i,
      /estatísticas?/i,
      /análise de performance/i,
    ];

    // Content creation patterns
    const contentPatterns = [
      /criar?\s+(um\s+)?(post|conteúdo|carrossel|reels?|stories?|thread|newsletter)/i,
      /escrever?\s+(um\s+)?(post|texto|legenda|caption|artigo)/i,
      /gerar?\s+(um\s+)?(conteúdo|post|texto)/i,
      /fazer?\s+(um\s+)?(post|conteúdo)/i,
      /me\s+ajuda?\s+(a\s+)?(criar|escrever|fazer)/i,
      /preciso\s+(de\s+)?(um\s+)?(post|conteúdo|texto)/i,
    ];

    // Planning patterns
    const planningPatterns = [
      /criar?\s+(um\s+)?card\s+(no\s+)?planejamento/i,
      /adicionar?\s+(ao\s+)?planejamento/i,
      /agendar?\s+(um\s+)?(post|conteúdo|publicação)/i,
      /organizar?\s+(o\s+)?calendário/i,
      /próxim[ao]s?\s+\d+/i, // "próximas 4 quartas"
      /ideias?\s+(de\s+)?conteúdo/i,
      /sugest[ãõ]es?\s+(de\s+)?posts?/i,
      /planejar?\s+(o\s+)?mês/i,
      /criar?\s+\d+\s+(posts?|conteúdos?|ideias?)/i, // "criar 5 posts"
    ];

    // Check for metrics queries
    if (metricsPatterns.some(p => p.test(lowerMessage))) {
      // Extract period if mentioned
      let period: string | undefined;
      const monthMatch = lowerMessage.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/);
      if (monthMatch) period = monthMatch[1];
      else if (lowerMessage.includes("último mês") || lowerMessage.includes("mês passado")) period = "último mês";
      else if (lowerMessage.includes("últimos 7 dias") || lowerMessage.includes("última semana")) period = "última semana";

      decision = {
        pipeline: "metrics_analysis",
        agent: "metrics",
        confidence: 0.9,
        reason: "Pergunta sobre métricas ou performance detectada",
        extractedParams: {
          platform: lowerMessage.includes("instagram") ? "instagram" : 
                    lowerMessage.includes("youtube") ? "youtube" :
                    lowerMessage.includes("newsletter") ? "newsletter" : undefined,
          period,
        },
      };
    }
    // Check for content creation
    else if (contentPatterns.some(p => p.test(lowerMessage))) {
      // Extract format
      let format: string | undefined;
      let contentType: string | undefined;
      if (/newsletter/i.test(lowerMessage)) { format = "newsletter"; contentType = "newsletter"; }
      else if (/carrossel|carousel/i.test(lowerMessage)) { format = "carousel"; contentType = "carousel"; }
      else if (/reels?/i.test(lowerMessage)) { format = "reels"; contentType = "short_video"; }
      else if (/stories?|story/i.test(lowerMessage)) { format = "stories"; contentType = "stories"; }
      else if (/thread/i.test(lowerMessage)) { format = "thread"; contentType = "thread"; }
      else if (/post|publicação/i.test(lowerMessage)) { format = "post"; contentType = "static_post"; }

      decision = {
        pipeline: "multi_agent_content",
        agent: "content",
        confidence: 0.85,
        reason: "Solicitação de criação de conteúdo detectada",
        extractedParams: {
          format,
          contentType,
          platform: lowerMessage.includes("instagram") ? "instagram" :
                    lowerMessage.includes("twitter") || lowerMessage.includes("x") ? "twitter" :
                    lowerMessage.includes("linkedin") ? "linkedin" : undefined,
        },
      };
    }
    // Check for planning
    else if (planningPatterns.some(p => p.test(lowerMessage))) {
      // Extract quantity if mentioned
      const quantityMatch = lowerMessage.match(/(\d+)\s*(posts?|conteúdos?|ideias?|cards?)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

      decision = {
        pipeline: "free_chat",
        agent: "planning",
        confidence: 0.85,
        reason: "Solicitação de planejamento ou agendamento detectada",
        extractedParams: {
          quantity,
          action: lowerMessage.includes("agendar") ? "schedule" :
                  lowerMessage.includes("ideia") || lowerMessage.includes("sugest") ? "suggest" :
                  "create",
        },
      };
    }
    // Default to general chat
    else {
      decision = {
        pipeline: "free_chat",
        agent: "general",
        confidence: 0.7,
        reason: "Conversa geral ou pergunta não específica",
        extractedParams: {},
      };
    }

    // Adjust based on files
    if (hasFiles && fileTypes) {
      if (fileTypes.includes("text/csv") || fileTypes.some(t => t.endsWith(".csv"))) {
        decision = {
          pipeline: "metrics_analysis",
          agent: "metrics",
          confidence: 0.95,
          reason: "Upload de CSV detectado - importação de métricas",
          extractedParams: { action: "import" },
        };
      }
    }

    console.log("Routing decision:", decision);

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Router error:", error);
    return new Response(
      JSON.stringify({ 
        pipeline: "free_chat",
        agent: "general", 
        confidence: 0.5, 
        reason: "Erro no roteamento",
        extractedParams: {} 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
