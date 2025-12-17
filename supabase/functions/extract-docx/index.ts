import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileName } = await req.json();

    if (!fileUrl) {
      throw new Error("fileUrl é obrigatório");
    }

    console.log(`Extracting DOCX content from: ${fileName || fileUrl}`);

    // Fetch the DOCX file
    const docxResponse = await fetch(fileUrl);
    if (!docxResponse.ok) {
      throw new Error(`Failed to fetch DOCX: ${docxResponse.statusText}`);
    }

    const docxBuffer = await docxResponse.arrayBuffer();
    const docxBase64 = btoa(
      new Uint8Array(docxBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Use Gemini Vision to extract text from DOCX
    const GOOGLE_AI_STUDIO_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_AI_STUDIO_API_KEY) {
      throw new Error("GOOGLE_AI_STUDIO_API_KEY not configured");
    }

    // Determine MIME type for .docx
    const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_STUDIO_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: docxBase64,
                  },
                },
                {
                  text: `Extraia TODO o texto deste documento Word (.docx).
Mantenha a estrutura e formatação original o máximo possível.
Inclua:
- Todos os títulos e subtítulos
- Todos os parágrafos
- Listas numeradas e com marcadores
- Tabelas (formate como texto organizado)
- Cabeçalhos e rodapés se houver
- Notas de rodapé

Retorne o conteúdo extraído em formato de texto puro, bem organizado.
Ao final, indique aproximadamente quantas páginas o documento possui.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 32000, // Maior limite para documentos grandes
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini error:", errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Try to extract page count from the response
    const pageCountMatch = extractedText.match(/(\d+)\s*página/i);
    const estimatedPageCount = pageCountMatch ? parseInt(pageCountMatch[1]) : Math.ceil(extractedText.length / 3000);

    console.log(`Extracted ${extractedText.length} characters from DOCX, estimated ${estimatedPageCount} pages`);

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
    console.error("DOCX extraction error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
