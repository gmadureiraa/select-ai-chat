import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  clientId?: string;
  workspaceId?: string;
  action?: {
    type: string;
    params: Record<string, unknown>;
  };
  format?: string;
}

// Month name to number mapping (Portuguese)
const monthMap: Record<string, number> = {
  janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function extractDateFilter(message: string): { startDate?: Date; endDate?: Date; monthName?: string } {
  const lowerMessage = message.toLowerCase();
  
  // Check for specific month mentions
  for (const [monthName, monthNum] of Object.entries(monthMap)) {
    if (lowerMessage.includes(monthName)) {
      const now = new Date();
      const year = monthNum > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
      const startDate = new Date(year, monthNum, 1);
      const endDate = new Date(year, monthNum + 1, 0);
      return { startDate, endDate, monthName };
    }
  }
  
  // Check for relative time periods
  if (lowerMessage.includes("último mês") || lowerMessage.includes("mês passado")) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate, endDate };
  }
  
  if (lowerMessage.includes("últimos 30 dias") || lowerMessage.includes("último mês")) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate };
  }
  
  if (lowerMessage.includes("últimos 7 dias") || lowerMessage.includes("última semana")) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    return { startDate, endDate };
  }
  
  return {};
}

function isMetricsQuery(message: string): boolean {
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
    /instagram/i,
    /como est[áa]/i,
    /quantos?/i,
    /resultado/i,
    /estatísticas?/i,
  ];
  
  return metricsPatterns.some(pattern => pattern.test(message));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages, clientId, workspaceId, action, format } = await req.json() as RequestBody;
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Get client context if provided
    let clientContext = "";
    if (clientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("name, description, identity_guide, context_notes")
        .eq("id", clientId)
        .single();

      if (client) {
        clientContext = `
## Contexto do Cliente
Cliente selecionado: ${client.name}
Descrição: ${client.description || "Não informada"}
Guia de Identidade: ${client.identity_guide || "Não definido"}
Notas de Contexto: ${client.context_notes || "Nenhuma"}
`;
      }
    }

    // Fetch metrics if this is a metrics-related query
    let metricsContext = "";
    if (clientId && isMetricsQuery(lastMessage)) {
      const dateFilter = extractDateFilter(lastMessage);
      
      // Build query for platform_metrics
      let metricsQuery = supabase
        .from("platform_metrics")
        .select("*")
        .eq("client_id", clientId)
        .order("metric_date", { ascending: false });
      
      // Apply date filter if found
      if (dateFilter.startDate && dateFilter.endDate) {
        metricsQuery = metricsQuery
          .gte("metric_date", dateFilter.startDate.toISOString().split("T")[0])
          .lte("metric_date", dateFilter.endDate.toISOString().split("T")[0]);
      } else {
        metricsQuery = metricsQuery.limit(30);
      }
      
      const { data: metrics } = await metricsQuery;
      
      // Also fetch recent Instagram posts for more detailed analysis
      const { data: instagramPosts } = await supabase
        .from("instagram_posts")
        .select("*")
        .eq("client_id", clientId)
        .order("posted_at", { ascending: false })
        .limit(20);
      
      if (metrics && metrics.length > 0) {
        // Group by platform
        const platformData: Record<string, typeof metrics> = {};
        metrics.forEach(m => {
          if (!platformData[m.platform]) platformData[m.platform] = [];
          platformData[m.platform].push(m);
        });
        
        let metricsReport = `\n## Dados de Métricas Disponíveis\n`;
        
        if (dateFilter.monthName) {
          metricsReport += `Período: ${dateFilter.monthName}\n\n`;
        } else if (dateFilter.startDate && dateFilter.endDate) {
          metricsReport += `Período: ${dateFilter.startDate.toLocaleDateString("pt-BR")} a ${dateFilter.endDate.toLocaleDateString("pt-BR")}\n\n`;
        } else {
          metricsReport += `Período: últimos registros disponíveis\n\n`;
        }
        
        for (const [platform, data] of Object.entries(platformData)) {
          metricsReport += `### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
          
          // Get most recent and oldest for comparisons
          const mostRecent = data[0];
          const oldest = data[data.length - 1];
          
          // Subscribers/Followers
          if (mostRecent.subscribers !== null) {
            const growth = mostRecent.subscribers - (oldest.subscribers || mostRecent.subscribers);
            const growthPercent = oldest.subscribers ? ((growth / oldest.subscribers) * 100).toFixed(2) : 0;
            metricsReport += `- Seguidores atuais: ${mostRecent.subscribers?.toLocaleString("pt-BR") || "N/A"}\n`;
            metricsReport += `- Crescimento no período: ${growth > 0 ? "+" : ""}${growth.toLocaleString("pt-BR")} (${growthPercent}%)\n`;
          }
          
          // Engagement
          const avgEngagement = data.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / data.length;
          if (avgEngagement > 0) {
            metricsReport += `- Taxa de engajamento média: ${avgEngagement.toFixed(2)}%\n`;
          }
          
          // Interactions
          const totalLikes = data.reduce((sum, m) => sum + (m.likes || 0), 0);
          const totalComments = data.reduce((sum, m) => sum + (m.comments || 0), 0);
          const totalViews = data.reduce((sum, m) => sum + (m.views || 0), 0);
          const totalShares = data.reduce((sum, m) => sum + (m.shares || 0), 0);
          
          if (totalLikes > 0) metricsReport += `- Total de curtidas: ${totalLikes.toLocaleString("pt-BR")}\n`;
          if (totalComments > 0) metricsReport += `- Total de comentários: ${totalComments.toLocaleString("pt-BR")}\n`;
          if (totalViews > 0) metricsReport += `- Total de views: ${totalViews.toLocaleString("pt-BR")}\n`;
          if (totalShares > 0) metricsReport += `- Total de compartilhamentos: ${totalShares.toLocaleString("pt-BR")}\n`;
          
          metricsReport += `\n`;
        }
        
        metricsContext = metricsReport;
      }
      
      // Add Instagram posts context if available
      if (instagramPosts && instagramPosts.length > 0) {
        metricsContext += `\n### Posts Recentes do Instagram\n`;
        metricsContext += `Total de posts analisados: ${instagramPosts.length}\n\n`;
        
        // Top performing posts
        const sortedByEngagement = [...instagramPosts].sort((a, b) => 
          (b.engagement_rate || 0) - (a.engagement_rate || 0)
        );
        
        metricsContext += `**Top 3 posts por engajamento:**\n`;
        sortedByEngagement.slice(0, 3).forEach((post, idx) => {
          metricsContext += `${idx + 1}. ${post.post_type || "post"} - Engajamento: ${(post.engagement_rate || 0).toFixed(2)}% | Curtidas: ${post.likes || 0} | Comentários: ${post.comments || 0}\n`;
          if (post.caption) {
            metricsContext += `   Caption: "${post.caption.slice(0, 100)}${post.caption.length > 100 ? "..." : ""}"\n`;
          }
        });
        
        // Average metrics
        const avgLikes = instagramPosts.reduce((sum, p) => sum + (p.likes || 0), 0) / instagramPosts.length;
        const avgComments = instagramPosts.reduce((sum, p) => sum + (p.comments || 0), 0) / instagramPosts.length;
        const avgEngagement = instagramPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / instagramPosts.length;
        
        metricsContext += `\n**Médias dos posts:**\n`;
        metricsContext += `- Curtidas: ${avgLikes.toFixed(0)}\n`;
        metricsContext += `- Comentários: ${avgComments.toFixed(0)}\n`;
        metricsContext += `- Engajamento: ${avgEngagement.toFixed(2)}%\n`;
      }
    }

    // Get format rules if format is specified
    let formatContext = "";
    if (format && workspaceId) {
      const { data: formatRules } = await supabase
        .from("format_rules")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("format_id", format)
        .single();
      
      if (formatRules) {
        formatContext = `
## Regras do Formato: ${formatRules.name}
${formatRules.description || ""}

### Estrutura:
${JSON.stringify(formatRules.rules, null, 2)}

${formatRules.prompt_template ? `### Template de Prompt:\n${formatRules.prompt_template}` : ""}
`;
      }
    }

    // Build system prompt
    const systemPrompt = `Você é a kAI, a assistente de IA da plataforma Kaleidos - uma plataforma para gestão de marketing de conteúdo.

Você ajuda os usuários a:
1. Criar conteúdo para redes sociais (posts, carrosséis, reels, threads, newsletters)
2. Analisar métricas e performance - VOCÊ TEM ACESSO AOS DADOS REAIS DO CLIENTE
3. Gerenciar o planejamento de conteúdo
4. Organizar referências e biblioteca de conteúdo
5. Responder dúvidas sobre marketing digital

${clientContext}
${metricsContext}
${formatContext}

## Diretrizes:
- Seja conciso e direto nas respostas
- Use emojis com moderação para tornar a conversa mais amigável
- Quando o usuário pedir para criar conteúdo, pergunte detalhes se necessário (plataforma, tom, objetivo)
- QUANDO PERGUNTAREM SOBRE MÉTRICAS, USE OS DADOS ACIMA - você TEM acesso aos dados reais
- Ao analisar métricas, forneça insights acionáveis e específicos baseados nos dados
- Sempre considere o contexto do cliente selecionado
- Responda em português do Brasil
- Se tiver um formato especificado, siga rigorosamente as regras do formato

${action ? `\n## Ação em Execução\nO usuário solicitou: ${action.type}\nParâmetros: ${JSON.stringify(action.params)}` : ""}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao processar requisição");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("kAI chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
