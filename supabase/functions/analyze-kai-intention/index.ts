import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type KAIActionType =
  | "create_content"
  | "ask_about_metrics"
  | "upload_metrics"
  | "create_planning_card"
  | "upload_to_library"
  | "upload_to_references"
  | "analyze_url"
  | "general_chat";

interface AnalysisResult {
  actionType: KAIActionType;
  confidence: number;
  extractedParams: {
    clientName?: string;
    format?: string;
    date?: string;
    assignee?: string;
    url?: string;
    platform?: string;
  };
  requiresConfirmation: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, files, context } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um analisador de intenções para o kAI, um assistente de marketing digital.

Analise a mensagem do usuário e determine a intenção principal. Responda APENAS com um JSON válido.

Tipos de ação disponíveis:
- create_content: Criar conteúdo (posts, carrosséis, reels, stories, threads)
- ask_about_metrics: Perguntas sobre métricas e performance
- upload_metrics: Importar métricas de CSV
- create_planning_card: Criar card no planejamento/calendário
- upload_to_library: Adicionar à biblioteca de conteúdo
- upload_to_references: Adicionar às referências
- analyze_url: Analisar uma URL
- general_chat: Conversa geral (fallback)

Arquivos anexados: ${files ? JSON.stringify(files) : "nenhum"}
Contexto: ${context ? JSON.stringify(context) : "não especificado"}

Responda com este formato JSON exato:
{
  "actionType": "tipo_da_acao",
  "confidence": 0.0 a 1.0,
  "extractedParams": {
    "clientName": "nome do cliente se mencionado",
    "format": "post|carrossel|reels|stories|thread se mencionado",
    "date": "data se mencionada",
    "assignee": "responsável se mencionado",
    "url": "URL se presente",
    "platform": "instagram|youtube|newsletter|twitter|linkedin se mencionado"
  },
  "requiresConfirmation": true/false
}

Regras:
- Se houver arquivo CSV, é provavelmente upload_metrics
- Se houver URL e menção a "referência" ou "salvar", é upload_to_references
- Se houver URL e menção a "biblioteca", é upload_to_library
- create_content, upload_metrics, create_planning_card, upload_to_library, upload_to_references requerem confirmação
- Extraia APENAS parâmetros que estão explicitamente na mensagem`;

    console.log("Analyzing intention for message:", message.substring(0, 100));

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
          { role: "user", content: message },
        ],
        temperature: 0.1, // Low temperature for consistent classification
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response (handle markdown code blocks)
    let result: AnalysisResult;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, content];
      const jsonStr = jsonMatch[1] || content;
      result = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback to general chat
      result = {
        actionType: "general_chat",
        confidence: 0.5,
        extractedParams: {},
        requiresConfirmation: false,
      };
    }

    // Validate action type
    const validActions: KAIActionType[] = [
      "create_content",
      "ask_about_metrics",
      "upload_metrics",
      "create_planning_card",
      "upload_to_library",
      "upload_to_references",
      "analyze_url",
      "general_chat",
    ];

    if (!validActions.includes(result.actionType)) {
      result.actionType = "general_chat";
    }

    console.log("Detected intention:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-kai-intention:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        actionType: "general_chat",
        confidence: 0.5,
        extractedParams: {},
        requiresConfirmation: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
