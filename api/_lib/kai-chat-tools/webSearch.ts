/**
 * Tool `webSearch` — grounding via Gemini googleSearch nativo.
 *
 * Gemini permite `tools: [{googleSearch: {}}]` mas é mutuamente exclusivo com
 * `functionDeclarations` no mesmo request. Solução: essa tool faz uma chamada
 * SEPARADA pro Gemini com search ativado e devolve resposta + sources pro
 * loop principal usar.
 *
 * Modelo barato (Flash) por default pra não inflar custo. Cache não aplicável
 * (query única). Sources retornados como array de {title, uri} pra UI mostrar.
 */
import type { RegisteredTool } from './types.js';

interface WebSearchArgs {
  query: string;
  /** Idioma da resposta esperada. Default pt-BR. */
  language?: string;
}

interface WebSearchData {
  answer: string;
  sources: Array<{ title: string; uri: string }>;
  queryUsed: string;
}

interface GroundingMetadata {
  groundingChunks?: Array<{
    web?: { uri?: string; title?: string };
  }>;
  webSearchQueries?: string[];
}

export const webSearchTool: RegisteredTool<WebSearchArgs, WebSearchData> = {
  definition: {
    name: 'webSearch',
    description:
      'Pesquisa na web ao vivo via Google Search. Use quando precisar de fatos recentes, notícias de cripto, dados de mercado, ou qualquer informação fora da knowledge base do cliente. NÃO use pra coisas que já estão no contexto do cliente (use getClientContext) ou pra biblioteca do cliente (use searchLibrary).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query de busca em linguagem natural. Seja específico e use português quando relevante (ex: "preço do bitcoin hoje", "halving 2024 data").',
        },
        language: {
          type: 'string',
          description: 'Código do idioma da resposta esperada (pt-BR, en-US). Default pt-BR.',
        },
      },
      required: ['query'],
    },
  },
  handler: async (args) => {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: 'GOOGLE_API_KEY ausente — web search desabilitado.' };
    }
    const query = args.query?.trim();
    if (!query) {
      return { ok: false, error: 'query vazia.' };
    }
    const language = args.language?.trim() || 'pt-BR';

    try {
      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Pesquise: ${query}\n\nResponda em ${language} de forma direta e factual em até 6 frases. Cite fontes inline quando possível.`,
                },
              ],
            },
          ],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        return {
          ok: false,
          error: `Gemini search API ${resp.status}: ${errText.slice(0, 300)}`,
        };
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0];
      const answer = candidate?.content?.parts?.[0]?.text || '';
      const meta = candidate?.groundingMetadata as GroundingMetadata | undefined;

      const sources: Array<{ title: string; uri: string }> = [];
      if (meta?.groundingChunks) {
        for (const chunk of meta.groundingChunks) {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri,
            });
          }
        }
      }

      if (!answer) {
        return {
          ok: false,
          error: 'Gemini search retornou resposta vazia.',
        };
      }

      return {
        ok: true,
        data: {
          answer,
          sources,
          queryUsed: meta?.webSearchQueries?.[0] || query,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido na web search.',
      };
    }
  },
};
