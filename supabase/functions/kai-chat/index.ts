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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages, clientId, workspaceId, action } = await req.json() as RequestBody;

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
Cliente selecionado: ${client.name}
Descrição: ${client.description || "Não informada"}
Guia de Identidade: ${client.identity_guide || "Não definido"}
Notas de Contexto: ${client.context_notes || "Nenhuma"}
`;
      }
    }

    // Build system prompt
    const systemPrompt = `Você é a kAI, a assistente de IA da plataforma Kaleidos - uma plataforma para gestão de marketing de conteúdo.

Você ajuda os usuários a:
1. Criar conteúdo para redes sociais (posts, carrosséis, reels, threads)
2. Analisar métricas e performance
3. Gerenciar o planejamento de conteúdo
4. Organizar referências e biblioteca de conteúdo
5. Responder dúvidas sobre marketing digital

${clientContext ? `\n## Contexto do Cliente\n${clientContext}` : ""}

## Diretrizes:
- Seja conciso e direto nas respostas
- Use emojis com moderação para tornar a conversa mais amigável
- Quando o usuário pedir para criar conteúdo, pergunte detalhes se necessário (plataforma, tom, objetivo)
- Ao analisar métricas, forneça insights acionáveis
- Sempre considere o contexto do cliente selecionado
- Responda em português do Brasil

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
