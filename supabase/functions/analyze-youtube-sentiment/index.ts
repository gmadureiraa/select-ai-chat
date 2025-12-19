import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, comments } = await req.json();

    if (!clientId) {
      throw new Error('clientId is required');
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // If no comments provided, return default neutral score
    if (!comments || comments.length === 0) {
      return new Response(JSON.stringify({
        score: 50,
        label: "Neutro",
        totalComments: 0,
        insights: ["Sem comentários suficientes para análise"],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit comments to analyze (cost optimization)
    const commentsToAnalyze = comments.slice(0, 50);
    const commentsText = commentsToAnalyze.map((c: any) => 
      typeof c === 'string' ? c : c.text || c.comment || ''
    ).filter(Boolean).join('\n---\n');

    console.log(`Analyzing sentiment for ${commentsToAnalyze.length} comments`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um analista de sentimento de audiência. Analise os comentários do YouTube e retorne um JSON com:
- score: número de 0 a 100 (0 = muito negativo, 50 = neutro, 100 = muito positivo)
- label: "Ruim", "Regular", "Neutro", "Bom" ou "Excelente"
- insights: array com 2-3 insights curtos sobre o feedback da audiência

Considere:
- Elogios, agradecimentos = positivo
- Críticas construtivas = levemente negativo
- Spam, hate = muito negativo
- Perguntas neutras = neutro
- Emojis positivos = positivo

Retorne APENAS o JSON, sem markdown.`
          },
          {
            role: "user",
            content: `Analise estes ${commentsToAnalyze.length} comentários do YouTube:\n\n${commentsText}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON response
    let result;
    try {
      // Clean potential markdown formatting
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      result = {
        score: 50,
        label: "Neutro",
        insights: ["Análise em processamento"],
      };
    }

    // Save to database
    const supabaseServiceUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseService = createClient(supabaseServiceUrl, supabaseServiceKey);

    // Store sentiment in platform_metrics metadata
    const today = new Date().toISOString().split('T')[0];
    await supabaseService
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: 'youtube',
        metric_date: today,
        metadata: {
          sentiment_score: result.score,
          sentiment_label: result.label,
          sentiment_insights: result.insights,
          sentiment_updated_at: new Date().toISOString(),
          comments_analyzed: commentsToAnalyze.length,
        }
      }, {
        onConflict: 'client_id,platform,metric_date',
      });

    return new Response(JSON.stringify({
      score: result.score || 50,
      label: result.label || "Neutro",
      totalComments: commentsToAnalyze.length,
      insights: result.insights || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-youtube-sentiment:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      score: 50,
      label: "Neutro",
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});