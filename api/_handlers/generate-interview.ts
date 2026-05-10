// Adapter SV: /api/generate/interview (resolvido pelo router → generate-interview)
// Quando user marca "modo entrevista" no /create/new, geramos 3-5 perguntas
// que dão especificidade ao briefing antes de chamar /api/generate.
//
// Input  (ver maybeRunInterview em create-new.tsx):
//   { topic, niche?, tone?, language? }
// Output:
//   { questions: [{ id, question, why, suggestedAnswer? }] }
//
// O frontend tem fallback try/catch — se isso falhar, segue sem perguntas.
// Esse handler garante que o fluxo não trava silenciosamente quando o
// modo entrevista está ativado.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { callLLM } from '../_lib/llm.js';

interface InterviewPayload {
  topic?: string;
  niche?: string;
  tone?: string;
  language?: string;
}

interface InterviewQuestion {
  id: string;
  question: string;
  why: string;
  suggestedAnswer?: string;
}

const SYSTEM_PROMPT = `Você é um diretor editorial sênior. Sua função: ler o briefing
de um carrossel e devolver 3-5 perguntas que vão dar ESPECIFICIDADE ao
conteúdo final.

Cada pergunta:
- question: 1 linha objetiva, em PT-BR, que extrai um detalhe que só o autor sabe
  (caso real, número, situação, contexto, exemplo concreto).
- why: 1 linha explicando POR QUÊ essa pergunta importa pro carrossel ficar bom.
- suggestedAnswer (opcional): exemplo curto pra dar pista ao usuário.

REGRAS:
- Foco em DESBLOQUEAR. Pergunte coisas que o autor NÃO escreveu mas tem na cabeça.
- Evite perguntas genéricas ("qual seu objetivo?"). Vá pro concreto.
- Se o briefing já está MUITO específico, devolva [] (array vazio) — segue direto.
- Cada id pode ser tipo "q1", "q2", "q3"...

Devolva APENAS JSON válido (sem markdown):
{
  "questions": [
    { "id": "q1", "question": "...", "why": "...", "suggestedAnswer": "..." },
    ...
  ]
}`;

function buildUserPrompt(p: InterviewPayload): string {
  const lines: string[] = [];
  lines.push(`BRIEFING: ${p.topic ?? ''}`);
  if (p.niche) lines.push(`NICHO: ${p.niche}`);
  if (p.tone) lines.push(`TOM: ${p.tone}`);
  if (p.language) lines.push(`IDIOMA: ${p.language}`);
  lines.push('');
  lines.push('Gere as perguntas. APENAS JSON.');
  return lines.join('\n');
}

function tryParseQuestions(raw: string): InterviewQuestion[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  const arr = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return arr
    .map((q: any, i: number): InterviewQuestion | null => {
      if (!q || typeof q !== 'object') return null;
      const question = typeof q.question === 'string' ? q.question.trim() : '';
      const why = typeof q.why === 'string' ? q.why.trim() : '';
      if (!question) return null;
      const id = typeof q.id === 'string' && q.id.trim() ? q.id.trim() : `q${i + 1}`;
      const suggestedAnswer =
        typeof q.suggestedAnswer === 'string' ? q.suggestedAnswer.trim() : undefined;
      return { id, question, why, suggestedAnswer };
    })
    .filter((q): q is InterviewQuestion => q !== null);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  const body = (req.body ?? {}) as InterviewPayload;
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
        temperature: 0.75,
        maxTokens: 1500,
        usageContext: {
          userId: auth.id,
          edgeFunction: 'generate-interview',
        },
      },
    );

    const questions = tryParseQuestions(result.content);
    return res.status(200).json({ questions });
  } catch (err: any) {
    console.error('[generate-interview] error:', err?.message || err);
    // Não bloqueia: devolve [] pra o frontend seguir sem perguntas.
    return res.status(200).json({ questions: [] });
  }
}
