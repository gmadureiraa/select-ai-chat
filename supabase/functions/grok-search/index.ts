import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query) {
      throw new Error("Query é obrigatório");
    }

    const GROK_API_KEY = Deno.env.get('GROK_API_KEY');
    
    if (!GROK_API_KEY) {
      throw new Error("GROK_API_KEY não configurada");
    }

    console.log("Pesquisando com Grok:", query);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de pesquisa especializado em buscar informações em tempo real. Forneça respostas precisas, atualizadas e bem fundamentadas sobre qualquer tópico solicitado.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Grok:', response.status, errorText);
      throw new Error(`Erro ao pesquisar: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    console.log("Pesquisa concluída");

    return new Response(
      JSON.stringify({ result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro em grok-search:', error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
