// Migrated from supabase/functions/extract-docx/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const MODEL = 'gemini-2.5-flash';

export default authedPost(async ({ user, body }) => {
  const { fileUrl, fileName, userId, clientId } = body;
  if (!fileUrl) throw new Error('fileUrl é obrigatório');
  if (clientId) await assertClientAccess(user.id, clientId);

  console.log(`Extracting DOCX content from: ${fileName || fileUrl}`);

  const docxResponse = await fetch(fileUrl);
  if (!docxResponse.ok) throw new Error(`Failed to fetch DOCX: ${docxResponse.statusText}`);
  const docxBuffer = await docxResponse.arrayBuffer();
  const docxBase64 = Buffer.from(docxBuffer).toString('base64');

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured');

  const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: docxBase64 } },
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
        generationConfig: { temperature: 0.1, maxOutputTokens: 32000 },
      }),
    }
  );

  if (!r.ok) {
    const errorText = await r.text();
    console.error('Gemini error:', errorText);
    throw new Error(`Gemini API error: ${r.status}`);
  }
  const data = await r.json();
  const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data?.usageMetadata?.promptTokenCount || Math.ceil(docxBase64.length / 4);
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || Math.ceil(extractedText.length / 4);

  const resolvedUserId = userId || user.id;
  if (resolvedUserId) {
    try {
      await getPool().query(
        `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [resolvedUserId, MODEL, 'extract-docx', inputTokens, outputTokens, JSON.stringify({ client_id: clientId, file_name: fileName })]
      );
    } catch (e) {
      console.warn('[extract-docx] usage log failed:', e);
    }
  }

  const pageCountMatch = extractedText.match(/(\d+)\s*página/i);
  const estimatedPageCount = pageCountMatch ? parseInt(pageCountMatch[1]) : Math.ceil(extractedText.length / 3000);

  console.log(`Extracted ${extractedText.length} characters from DOCX, ~${estimatedPageCount} pages`);

  return { content: extractedText, pageCount: estimatedPageCount, fileName };
});
