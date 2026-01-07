import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientData {
  name: string;
  description?: string;
  segment?: string;
  tone?: string;
  audience?: string;
  objectives?: string;
  socialMedia?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    website?: string;
    newsletter?: string;
  };
  websites?: string[];
  documentContents?: string[];
}

interface AnalysisResult {
  generated_at: string;
  executive_summary: string;
  visual_identity: {
    colors: string[];
    typography: string[];
    style: string;
    logo_url?: string;
  };
  tone_of_voice: {
    primary: string;
    secondary: string[];
    avoid: string[];
  };
  target_audience: {
    demographics: { age?: string; role?: string; location?: string };
    psychographics: string[];
  };
  objectives: string[];
  content_themes: string[];
  recommendations: string[];
  sources_analyzed: {
    website: boolean;
    branding: boolean;
    documents: number;
    social_profiles: string[];
  };
}

async function extractBranding(url: string, apiKey: string): Promise<any> {
  try {
    console.log("Extracting branding from:", url);
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["branding"],
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl branding error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.branding || data.branding || null;
  } catch (error) {
    console.error("Error extracting branding:", error);
    return null;
  }
}

async function scrapeWebsite(url: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Scraping website:", url);
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl scrape error:", response.status);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown;
    // Limit content to avoid token limits
    return markdown ? markdown.substring(0, 8000) : null;
  } catch (error) {
    console.error("Error scraping website:", error);
    return null;
  }
}

async function generateAnalysisWithAI(
  clientData: ClientData,
  branding: any,
  websiteContent: string | null,
  lovableApiKey: string
): Promise<AnalysisResult> {
  const systemPrompt = `Você é um especialista em branding, marketing digital e estratégia de conteúdo.
Sua tarefa é analisar profundamente todos os dados fornecidos sobre um cliente e gerar uma análise estruturada completa.
Seja específico e baseie suas análises nos materiais reais fornecidos.
Use "[Não identificado]" apenas se realmente não houver dados suficientes.
Responda SEMPRE em português brasileiro.`;

  const brandingInfo = branding
    ? `
IDENTIDADE VISUAL EXTRAÍDA:
- Cores: ${JSON.stringify(branding.colors || {})}
- Tipografia: ${JSON.stringify(branding.fonts || branding.typography || [])}
- Logo: ${branding.logo || branding.images?.logo || "Não encontrado"}
- Estilo: ${branding.colorScheme || "Não identificado"}
`
    : "Identidade visual não disponível.";

  const websiteInfo = websiteContent
    ? `
CONTEÚDO DO WEBSITE:
${websiteContent}
`
    : "Conteúdo do website não disponível.";

  const documentsInfo =
    clientData.documentContents && clientData.documentContents.length > 0
      ? `
DOCUMENTOS DO CLIENTE (${clientData.documentContents.length} documentos):
${clientData.documentContents.join("\n\n---\n\n").substring(0, 5000)}
`
      : "Nenhum documento disponível.";

  const userPrompt = `Analise este cliente e gere uma análise completa:

DADOS BÁSICOS:
- Nome: ${clientData.name}
- Descrição: ${clientData.description || "Não informada"}
- Segmento: ${clientData.segment || "Não informado"}
- Tom de voz desejado: ${clientData.tone || "Não informado"}
- Público-alvo: ${clientData.audience || "Não informado"}
- Objetivos: ${clientData.objectives || "Não informados"}

REDES SOCIAIS:
- Instagram: ${clientData.socialMedia?.instagram || "N/A"}
- LinkedIn: ${clientData.socialMedia?.linkedin || "N/A"}
- Twitter: ${clientData.socialMedia?.twitter || "N/A"}
- YouTube: ${clientData.socialMedia?.youtube || "N/A"}
- TikTok: ${clientData.socialMedia?.tiktok || "N/A"}
- Website: ${clientData.socialMedia?.website || "N/A"}
- Newsletter: ${clientData.socialMedia?.newsletter || "N/A"}

${brandingInfo}

${websiteInfo}

${documentsInfo}

Gere uma análise estruturada usando a função generate_client_analysis.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "generate_client_analysis",
        description: "Gera uma análise estruturada completa do cliente",
        parameters: {
          type: "object",
          properties: {
            executive_summary: {
              type: "string",
              description: "Resumo executivo de 2-3 frases sobre a empresa/marca",
            },
            visual_identity: {
              type: "object",
              properties: {
                colors: {
                  type: "array",
                  items: { type: "string" },
                  description: "Cores principais da marca em hexadecimal",
                },
                typography: {
                  type: "array",
                  items: { type: "string" },
                  description: "Fontes/tipografias identificadas",
                },
                style: {
                  type: "string",
                  description: "Estilo visual geral (ex: minimalista, vibrante, corporativo)",
                },
              },
              required: ["colors", "typography", "style"],
            },
            tone_of_voice: {
              type: "object",
              properties: {
                primary: {
                  type: "string",
                  description: "Tom de voz principal (ex: profissional, casual, técnico)",
                },
                secondary: {
                  type: "array",
                  items: { type: "string" },
                  description: "Características secundárias do tom",
                },
                avoid: {
                  type: "array",
                  items: { type: "string" },
                  description: "O que evitar na comunicação",
                },
              },
              required: ["primary", "secondary", "avoid"],
            },
            target_audience: {
              type: "object",
              properties: {
                demographics: {
                  type: "object",
                  properties: {
                    age: { type: "string" },
                    role: { type: "string" },
                    location: { type: "string" },
                  },
                },
                psychographics: {
                  type: "array",
                  items: { type: "string" },
                  description: "Características psicográficas do público",
                },
              },
              required: ["demographics", "psychographics"],
            },
            objectives: {
              type: "array",
              items: { type: "string" },
              description: "Objetivos de marketing/conteúdo sugeridos",
            },
            content_themes: {
              type: "array",
              items: { type: "string" },
              description: "Temas principais para produção de conteúdo",
            },
            recommendations: {
              type: "array",
              items: { type: "string" },
              description: "3-5 recomendações estratégicas específicas",
            },
          },
          required: [
            "executive_summary",
            "visual_identity",
            "tone_of_voice",
            "target_audience",
            "objectives",
            "content_themes",
            "recommendations",
          ],
        },
      },
    },
  ];

  console.log("Calling Lovable AI for analysis...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "generate_client_analysis" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", response.status, errorText);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall?.function?.arguments) {
    console.error("No tool call in response:", data);
    throw new Error("AI did not return structured analysis");
  }

  const analysisData = JSON.parse(toolCall.function.arguments);

  // Build sources analyzed
  const sourcesAnalyzed = {
    website: !!websiteContent,
    branding: !!branding,
    documents: clientData.documentContents?.length || 0,
    social_profiles: Object.entries(clientData.socialMedia || {})
      .filter(([_, v]) => v)
      .map(([k]) => k),
  };

  // Merge branding data if available
  const visualIdentity = {
    colors: analysisData.visual_identity?.colors || [],
    typography: analysisData.visual_identity?.typography || [],
    style: analysisData.visual_identity?.style || "Não identificado",
    logo_url: branding?.logo || branding?.images?.logo,
  };

  // Add extracted colors from branding if AI didn't find any
  if (visualIdentity.colors.length === 0 && branding?.colors) {
    const colors = branding.colors;
    if (colors.primary) visualIdentity.colors.push(colors.primary);
    if (colors.secondary) visualIdentity.colors.push(colors.secondary);
    if (colors.accent) visualIdentity.colors.push(colors.accent);
  }

  return {
    generated_at: new Date().toISOString(),
    executive_summary: analysisData.executive_summary,
    visual_identity: visualIdentity,
    tone_of_voice: analysisData.tone_of_voice,
    target_audience: analysisData.target_audience,
    objectives: analysisData.objectives,
    content_themes: analysisData.content_themes,
    recommendations: analysisData.recommendations,
    sources_analyzed: sourcesAnalyzed,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clientData } = await req.json();

    if (!clientData || !clientData.name) {
      return new Response(JSON.stringify({ error: "Client data with name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Starting client analysis for:", clientData.name);

    let branding = null;
    let websiteContent = null;

    // Extract branding and content from website if available
    const websiteUrl = clientData.socialMedia?.website || clientData.websites?.[0];
    if (websiteUrl && firecrawlApiKey) {
      // Run branding and scraping in parallel
      const [brandingResult, contentResult] = await Promise.all([
        extractBranding(websiteUrl, firecrawlApiKey),
        scrapeWebsite(websiteUrl, firecrawlApiKey),
      ]);
      branding = brandingResult;
      websiteContent = contentResult;
    }

    // Generate AI analysis
    const analysis = await generateAnalysisWithAI(
      clientData,
      branding,
      websiteContent,
      lovableApiKey
    );

    console.log("Analysis completed successfully");

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-client-onboarding:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
