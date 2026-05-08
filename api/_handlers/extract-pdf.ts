// Migrated from supabase/functions/extract-pdf/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

const MODEL = 'gemini-2.5-flash';

export default authedPost(async ({ user, body }) => {
  const { fileUrl, fileName, userId } = body;
  if (!fileUrl) throw new Error('fileUrl é obrigatório');

  console.log(`[extract-pdf] Extracting from: ${fileName || fileUrl}`);

  const pdfResponse = await fetch(fileUrl);
  if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);

  const pdfBuffer = await pdfResponse.arrayBuffer();
  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured');

  const prompt = `Extraia todo o texto deste PDF.
Mantenha a estrutura e formatação original o máximo possível.
Inclua títulos, subtítulos, parágrafos, listas e tabelas.
Se houver imagens com texto, transcreva o texto das imagens também.
Ao final, indique aproximadamente quantas páginas o documento possui.

Retorne o conteúdo extraído em formato de texto puro, bem organizado.`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16000 },
      }),
    }
  );

  if (!r.ok) {
    const errorText = await r.text();
    console.error('[extract-pdf] Gemini error:', errorText);
    throw new Error(`Gemini API error: ${r.status}`);
  }
  const data = await r.json();
  const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data?.usageMetadata?.promptTokenCount || Math.ceil(pdfBase64.length / 4);
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || Math.ceil(extractedText.length / 4);

  // Log AI usage
  const resolvedUserId = userId || user.id;
  if (resolvedUserId) {
    try {
      await getPool().query(
        `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [resolvedUserId, MODEL, 'extract-pdf', inputTokens, outputTokens, JSON.stringify({ fileName, pdfSizeBytes: pdfBuffer.byteLength })]
      );
    } catch (e) {
      console.warn('[extract-pdf] usage log failed:', e);
    }
  }

  const pageCountMatch = extractedText.match(/(\d+)\s*página/i);
  const estimatedPageCount = pageCountMatch ? parseInt(pageCountMatch[1]) : Math.ceil(extractedText.length / 3000);

  return { content: extractedText, pageCount: estimatedPageCount, fileName };
});
