// Adapter SV: /api/generate-concepts → gera 5 ângulos editoriais para um tema
// usando Gemini Flash. Chamado por concepts.tsx no fluxo /create/<id>/concepts.
//
// Input  (SvGenerateConceptsInput, ver use-generate.ts):
//   { topic, niche, tone, language, sourceType?, sourceUrl? }
// Output (esperado pelo useGenerate.generateConcepts):
//   { concepts: [{ title, hook, style, angle }, ...] }
//
// Não persiste nada — a página só usa pra mostrar 5 cards. Quando user
// seleciona, o concepts.tsx chama /api/generate (que persiste o carrossel).
//
// Os 5 ângulos seguem arquétipos clássicos de copywriting viral:
//   1. data       — número/dado-shock que prende
//   2. story      — caso real / bastidor / contradição vivida
//   3. provocative — opinião contrária ao consenso
//   4. tutorial   — passo-a-passo prático ("como fazer X em 5 passos")
//   5. mechanism  — explica POR QUÊ algo funciona (modelo mental)
//
// Ground truth: o app `code/sequencia-viral` original usa esse mesmo prompt
// (ver app/api/generate-concepts/route.ts no postflow). Replicado aqui pro
// KAI sem mudar a UI.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { callLLM } from '../_lib/llm.js';

interface ConceptsPayload {
  topic?: string;
  niche?: string;
  tone?: string;
  language?: string;
  sourceType?: 'idea' | 'video' | 'link' | 'instagram';
  sourceUrl?: string;
}

interface Concept {
  title: string;
  hook: string;
  style: string;
  angle: string;
}

const SYSTEM_PROMPT = `Você é um diretor editorial sênior especializado em carrosséis virais
de Instagram/LinkedIn pra criadores e prestadores de serviço brasileiros.

Sua função: receber um tema bruto e devolver CINCO ângulos editoriais
DIFERENTES — cada um com voz própria. Os 5 ângulos canônicos são:

1. DATA — abre com um número/dado-shock que prende a atenção.
2. STORY — caso real, bastidor, contradição vivida em primeira pessoa.
3. PROVOCATIVE — opinião contrária ao consenso, postura corajosa.
4. TUTORIAL — passo-a-passo prático ("como fazer X em 5 passos").
5. MECHANISM — explica POR QUÊ algo funciona (modelo mental, princípio).

Para cada ângulo, devolva:
- title: chamada curta (até 80 chars) específica do ângulo
- hook: primeira frase do carrossel — provocativa, em 1ª pessoa quando possível
- style: um dos cinco rótulos acima (data | story | provocative | tutorial | mechanism)
- angle: parágrafo de 3-5 linhas explicando o ângulo (PT-BR direto, sem jargão)

REGRAS DURAS:
- PT-BR informal, frases curtas. Sem hashtag. Sem emoji decorativo.
- Cada ângulo precisa abordar o MESMO tema mas com perspectiva radicalmente diferente.
- NUNCA repita estrutura ou abertura — variedade é o ponto.
- Se o tema for genérico ("marketing digital"), encontre 5 facetas concretas.

Devolva APENAS JSON válido nesse shape (sem markdown, sem comentário):
{
  "concepts": [
    { "title": "...", "hook": "...", "style": "data", "angle": "..." },
    ...
  ]
}`;

function buildUserPrompt(p: ConceptsPayload): string {
  const lines: string[] = [];
  lines.push(`TEMA: ${p.topic ?? ''}`);
  if (p.niche) lines.push(`NICHO: ${p.niche}`);
  if (p.tone) lines.push(`TOM: ${p.tone}`);
  if (p.language) lines.push(`IDIOMA: ${p.language}`);
  if (p.sourceType && p.sourceType !== 'idea') {
    lines.push(`FONTE: ${p.sourceType}${p.sourceUrl ? ` (${p.sourceUrl})` : ''}`);
  }
  lines.push('');
  lines.push('Gere os 5 ângulos seguindo os arquétipos. Devolva APENAS o JSON.');
  return lines.join('\n');
}

function tryParseConcepts(raw: string): Concept[] {
  // Limpa cercas markdown (```json ... ```) que o Gemini às vezes solta
  // mesmo sob instrução de "apenas JSON".
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Última tentativa: extrai o primeiro objeto JSON via regex
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }

  const arr = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
  return arr
    .map((c: any): Concept | null => {
      if (!c || typeof c !== 'object') return null;
      const title = typeof c.title === 'string' ? c.title.trim() : '';
      const hook = typeof c.hook === 'string' ? c.hook.trim() : '';
      const angle = typeof c.angle === 'string' ? c.angle.trim() : '';
      const style = typeof c.style === 'string' ? c.style.trim() : 'data';
      if (!title || !angle) return null;
      return { title, hook, style, angle };
    })
    .filter((c): c is Concept => c !== null);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  const body = (req.body ?? {}) as ConceptsPayload;
  const topic = (body.topic ?? '').trim();
  if (!topic) return jsonError(res, 400, 'topic is required');

  try {
    const result = await callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(body) },
      ],
      {
        provider: 'auto',
        model: 'gemini-2.5-flash',
        temperature: 0.85,
        maxTokens: 2048,
        usageContext: {
          userId: auth.id,
          edgeFunction: 'generate-concepts',
          metadata: { topic_len: topic.length },
        },
      },
    );

    const concepts = tryParseConcepts(result.content);
    if (concepts.length === 0) {
      console.warn('[generate-concepts] parse failed', {
        rawSample: result.content.slice(0, 400),
      });
      return jsonError(
        res,
        502,
        'IA não devolveu ângulos válidos. Tente outro tema ou refrasear.',
      );
    }

    return res.status(200).json({ concepts });
  } catch (err: any) {
    console.error('[generate-concepts] error:', err?.message || err);
    return jsonError(
      res,
      500,
      err?.message
        ? `Falha ao gerar conceitos: ${err.message}`
        : 'Erro inesperado ao gerar conceitos.',
    );
  }
}
