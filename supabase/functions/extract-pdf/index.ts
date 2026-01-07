import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { fileUrl, fileName, userId } = await req.json();

    if (!fileUrl) {
      throw new Error("fileUrl é obrigatório");
    }

    console.log(`[extract-pdf] Extracting from: ${fileName || fileUrl}`);

    // Fetch the PDF file
    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Use Gemini Vision to extract text from PDF
    const GOOGLE_AI_STUDIO_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_AI_STUDIO_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    const MODEL = "gemini-2.5-flash";
    const prompt = `Extraia todo o texto deste PDF. 
Mantenha a estrutura e formatação original o máximo possível.
Inclua títulos, subtítulos, parágrafos, listas e tabelas.
Se houver imagens com texto, transcreva o texto das imagens também.
Ao final, indique aproximadamente quantas páginas o documento possui.

Retorne o conteúdo extraído em formato de texto puro, bem organizado.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_AI_STUDIO_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16000,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("[extract-pdf] Gemini error:", errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Get token usage from response
    const inputTokens = geminiData.usageMetadata?.promptTokenCount || estimateTokens(prompt) + Math.ceil(pdfBase64.length / 4);
    const outputTokens = geminiData.usageMetadata?.candidatesTokenCount || estimateTokens(extractedText);

    // Log AI usage
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await logAIUsage(
        supabase,
        userId,
        MODEL,
        "extract-pdf",
        inputTokens,
        outputTokens,
        { fileName, pdfSizeBytes: pdfBuffer.byteLength }
      );
    }

    // Try to extract page count from the response
    const pageCountMatch = extractedText.match(/(\d+)\s*página/i);
    const estimatedPageCount = pageCountMatch ? parseInt(pageCountMatch[1]) : Math.ceil(extractedText.length / 3000);

    console.log(`[extract-pdf] Extracted ${extractedText.length} chars, ~${estimatedPageCount} pages, ${inputTokens + outputTokens} tokens`);

    return new Response(
      JSON.stringify({
        content: extractedText,
        pageCount: estimatedPageCount,
        fileName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[extract-pdf] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
