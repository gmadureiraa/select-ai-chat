import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  checkWorkspaceTokens, 
  debitWorkspaceTokens, 
  getWorkspaceIdFromUser,
  createInsufficientTokensResponse,
  TOKEN_COSTS 
} from "../_shared/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessRequest {
  type: "url" | "summarize" | "embed";
  url?: string;
  content?: string;
  knowledgeId?: string;
  userId?: string;
  workspaceId?: string;
}

async function scrapeUrl(url: string): Promise<{ title: string; content: string; description: string }> {
  console.log("[process-knowledge] Scraping URL:", url);
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.statusText}`);
  }

  const html = await response.text();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1] : "";

  // Extract text content
  let textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // Limit content size
  textContent = textContent.substring(0, 30000);

  return { title, content: textContent, description };
}

async function generateSummary(content: string): Promise<{ summary: string; keyTakeaways: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  console.log("[process-knowledge] Generating summary...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em sumarização de conteúdo. Analise o texto e extraia:
1. Um resumo conciso (máximo 3 parágrafos) do conteúdo principal
2. De 3 a 7 key takeaways (pontos-chave) mais importantes

Responda APENAS em JSON válido com este formato:
{
  "summary": "resumo aqui...",
  "keyTakeaways": ["takeaway 1", "takeaway 2", ...]
}`
        },
        {
          role: "user",
          content: `Analise e resuma este conteúdo:\n\n${content.substring(0, 15000)}`
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[process-knowledge] AI error:", errorText);
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || "";

  // Parse JSON from response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || "",
        keyTakeaways: parsed.keyTakeaways || []
      };
    }
  } catch (e) {
    console.error("[process-knowledge] Failed to parse AI response:", e);
  }

  return {
    summary: responseText.substring(0, 1000),
    keyTakeaways: []
  };
}

async function generateEmbedding(text: string): Promise<number[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  console.log("[process-knowledge] Generating embedding...");

  // Use Gemini embedding model
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000),
      dimensions: 768
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[process-knowledge] Embedding error:", errorText);
    throw new Error(`Embedding request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
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

    const body: ProcessRequest = await req.json();
    const { type, url, content, knowledgeId, workspaceId: providedWorkspaceId } = body;

    console.log(`[process-knowledge] Processing type: ${type}`);

    // Get workspace ID and check tokens
    const workspaceId = providedWorkspaceId || await getWorkspaceIdFromUser(user.id);
    if (!workspaceId) {
      console.error("[process-knowledge] Could not determine workspace");
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenCost = TOKEN_COSTS.knowledge_processing;
    const tokenCheck = await checkWorkspaceTokens(workspaceId, tokenCost);
    
    if (!tokenCheck.hasTokens) {
      console.warn(`[process-knowledge] Insufficient tokens for workspace ${workspaceId}`);
      return createInsufficientTokensResponse(corsHeaders);
    }

    let result: any = {};

    if (type === "url" && url) {
      // Scrape URL and generate summary + embedding
      const scraped = await scrapeUrl(url);
      const { summary, keyTakeaways } = await generateSummary(scraped.content);
      const embedding = await generateEmbedding(scraped.content);

      result = {
        title: scraped.title,
        content: scraped.content,
        description: scraped.description,
        summary,
        keyTakeaways,
        embedding,
        sourceUrl: url
      };
    } else if (type === "summarize" && content) {
      // Just summarize existing content
      const { summary, keyTakeaways } = await generateSummary(content);
      result = { summary, keyTakeaways };
    } else if (type === "embed" && content) {
      // Just generate embedding
      const embedding = await generateEmbedding(content);
      result = { embedding };
    } else {
      throw new Error("Invalid request: missing type or required data");
    }

    // If knowledgeId provided, update the record
    if (knowledgeId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const updateData: any = {};
      if (result.summary) updateData.summary = result.summary;
      if (result.keyTakeaways) updateData.key_takeaways = result.keyTakeaways;
      if (result.embedding) updateData.embedding = result.embedding;
      if (result.sourceUrl) updateData.source_url = result.sourceUrl;

      const { error } = await supabase
        .from("global_knowledge")
        .update(updateData)
        .eq("id", knowledgeId);

      if (error) {
        console.error("[process-knowledge] Update error:", error);
      }
    }

    // Debit tokens after successful processing
    const debitResult = await debitWorkspaceTokens(
      workspaceId,
      user.id,
      tokenCost,
      "Processamento de conhecimento",
      { type, knowledgeId }
    );
    
    if (!debitResult.success) {
      console.warn(`[process-knowledge] Token debit failed: ${debitResult.error}`);
    }

    console.log(`[process-knowledge] Success - ${tokenCost} tokens debited`);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[process-knowledge] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
