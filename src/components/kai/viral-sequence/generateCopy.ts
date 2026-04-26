/**
 * Geração de copies de carrossel Twitter via edge function `kai-content-agent`.
 *
 * Pede pro KAI 8 slides no formato JSON estrito. Parser tolerante — aceita
 * JSON sujo com markdown/texto antes, extrai o primeiro array válido.
 *
 * Retorna sempre 8 slides (completa com vazios se a IA devolver menos).
 */

import { supabase } from "@/integrations/supabase/client";
import type { ViralSlide } from "./types";
import { emptySlide } from "./types";

const TARGET_SLIDES = 8;

interface GenerateCopyInput {
  clientId: string;
  briefing: string;
  tone?: string; // ex: "direto, provocativo"
  additionalContext?: string;
}

interface GeneratedSlideRaw {
  heading?: string;
  title?: string;
  body?: string;
  text?: string;
  content?: string;
  // Slide 1 editorial
  kicker?: string;
  headline?: string;
  subtitle?: string;
  credit?: string;
}

function buildPrompt(input: GenerateCopyInput): string {
  const { briefing, tone, additionalContext } = input;
  return [
    "Você vai gerar um carrossel de 8 slides estilo tweet sobre o tema abaixo.",
    "Cada slide é UM tweet completo — texto livre com **palavras em negrito** pra destacar trechos-chave.",
    "",
    `TEMA/BRIEFING: ${briefing}`,
    tone ? `\nTOM: ${tone}` : "",
    additionalContext ? `\nCONTEXTO ADICIONAL:\n${additionalContext}` : "",
    "",
    "REGRAS DOS SLIDES:",
    "- 8 slides no total, cada um com até ~280 caracteres (pode respirar em 2-3 parágrafos curtos).",
    "- Slide 1 (CAPA EDITORIAL): retorne os campos `kicker`, `headline`, `subtitle`, `credit` (estilo capa de jornal). NÃO use `body` no slide 1. Headline = manchete forte e curta (até 80 chars). Subtitle = lead/contexto (até 140 chars). Kicker = categoria curta em CAIXA ALTA (ex: MERCADO, TECNOLOGIA, OPINIÃO). Credit = fonte ou autor curto (opcional).",
    "- Slides 2-7: UM insight por slide no campo `body`. Pense em tweet de thread — direto ao ponto, 1-3 frases. Destaque o termo-chave com **negrito**.",
    "- Slide 8 (CTA): chamada clara pra ação no campo `body` (comentar, salvar, compartilhar, seguir).",
    "- Linguagem informal, direta, em pt-BR. Nada genérico ou corporativo.",
    "- Use **negrito** em 1-3 palavras por slide pra criar hierarquia visual (slides 2-8). Não use ** no headline/subtitle do slide 1.",
    "- NÃO use hashtags (é carrossel, não post solto).",
    "- NÃO numere os slides no texto — a numeração é automática.",
    "",
    "FORMATO DE SAÍDA: APENAS um array JSON válido, sem texto antes nem depois.",
    "Slide 1: { \"kicker\": string, \"headline\": string, \"subtitle\": string, \"credit\": string }",
    "Slides 2-8: { \"body\": string }",
    "",
    "Exemplo:",
    '[{"kicker":"MERCADO","headline":"Bitcoin dispara 12% e renova máxima histórica","subtitle":"Aprovação de ETFs e fluxo institucional empurram preço acima dos US$ 100 mil pela primeira vez","credit":"Reuters"},{"body":"Ninguém te conta isso sobre **self-custody**, mas aqui vai: você não é o dono do seu Bitcoin até ter as chaves."},{"body":"**Erro 1:** manter na exchange esperando \\"ficar mais fácil\\". Exchange quebra, seu Bitcoin vai junto."}]',
    "",
    "Agora gera os 8 slides pro tema acima.",
  ].filter(Boolean).join("\n");
}

function extractJsonArray(text: string): unknown[] | null {
  // Remove code fences ```json ... ```
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  // Procura primeiro `[` e último `]`
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeSlides(raw: unknown[]): ViralSlide[] {
  const slides: ViralSlide[] = [];
  for (let i = 0; i < raw.length && i < TARGET_SLIDES; i++) {
    const item = raw[i] as GeneratedSlideRaw;
    const order = i + 1;

    // Slide 1 — capa editorial (preferida quando vier headline)
    if (order === 1 && typeof item.headline === "string" && item.headline.trim()) {
      const headline = item.headline.trim();
      const subtitle = typeof item.subtitle === "string" ? item.subtitle.trim() : "";
      const credit = typeof item.credit === "string" ? item.credit.trim() : "";
      const kicker = typeof item.kicker === "string" ? item.kicker.trim() : "";
      slides.push({
        ...emptySlide(order),
        body: subtitle ? `**${headline}**\n\n${subtitle}` : `**${headline}**`,
        editorial: { headline, subtitle, credit, kicker },
      });
      continue;
    }

    const body = item.body ?? item.text ?? item.content ?? "";
    const heading = item.heading ?? item.title;
    let finalBody = typeof body === "string" ? body.trim() : "";
    if (typeof heading === "string" && heading.trim() && finalBody && !finalBody.startsWith("**")) {
      finalBody = `**${heading.trim()}**\n\n${finalBody}`;
    } else if (typeof heading === "string" && heading.trim() && !finalBody) {
      finalBody = `**${heading.trim()}**`;
    }
    slides.push({
      ...emptySlide(order),
      body: finalBody,
    });
  }
  while (slides.length < TARGET_SLIDES) {
    slides.push(emptySlide(slides.length + 1));
  }
  return slides;
}

export async function generateCarouselCopies(
  input: GenerateCopyInput,
): Promise<{ slides: ViralSlide[]; raw: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kai-content-agent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        clientId: input.clientId,
        request: buildPrompt(input),
        format: "twitter",
        platform: "twitter",
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`KAI agent ${response.status}: ${err.slice(0, 200)}`);
  }

  // Consome SSE stream acumulando tudo
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Resposta sem body");
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      const json = t.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) fullText += content;
      } catch {
        /* ignora linhas parcialmente buffered */
      }
    }
  }

  const arr = extractJsonArray(fullText);
  if (!arr) {
    throw new Error(
      "Não consegui extrair JSON da resposta do KAI. Texto bruto:\n" +
        fullText.slice(0, 500),
    );
  }
  return { slides: normalizeSlides(arr), raw: fullText };
}
