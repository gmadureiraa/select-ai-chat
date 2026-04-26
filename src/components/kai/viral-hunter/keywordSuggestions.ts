/**
 * Heurística pra extrair keywords sugeridas do perfil do cliente.
 *
 * Fontes (em ordem):
 *   1. tags.niche / tags.industry (campos diretos)
 *   2. voice_profile.use (frases que o cliente USA — boa fonte de jargões)
 *   3. identity_guide (texto livre — extrai termos capitalizados / hashtag-like)
 *   4. description (texto livre — fallback)
 *
 * Filtra stopwords PT/EN, normaliza pra lowercase, dedupica e limita a 8.
 */

import { supabase } from "@/integrations/supabase/client";

const STOPWORDS = new Set([
  // PT
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos",
  "para", "por", "com", "sem", "em", "no", "na", "nos", "nas", "que", "se", "mais",
  "ser", "ter", "eu", "você", "vocês", "ele", "ela", "este", "esta", "isso", "tudo",
  "ou", "e", "mas", "como", "quando", "onde", "porque", "sobre", "pelo", "pela",
  "muito", "muita", "todos", "todas", "cada", "qual", "quem", "porque",
  // EN
  "the", "a", "an", "of", "for", "with", "in", "on", "at", "to", "from", "and",
  "or", "but", "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "this", "that", "these", "those", "it", "its", "we", "they", "them", "their",
  "you", "your", "i", "me", "my", "he", "she", "his", "her",
]);

const MIN_LEN = 3;
const MAX_KEYWORDS = 8;

interface ClientProfileLike {
  description?: string | null;
  identity_guide?: string | null;
  tags?: Record<string, unknown> | null;
  voice_profile?: { use?: string[]; tone?: string } | null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter((t) => t.length >= MIN_LEN && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function bigrams(text: string): string[] {
  const tokens = tokenize(text);
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

function rank(tokens: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

export function suggestKeywordsFromProfile(client: ClientProfileLike): string[] {
  const out = new Set<string>();

  // 1. Tags diretas
  if (client.tags) {
    for (const key of ["niche", "industry", "vertical", "topic", "topics"]) {
      const v = client.tags[key];
      if (typeof v === "string") {
        v.split(/[,;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean).forEach((s) => out.add(s));
      }
    }
  }

  // 2. voice_profile.use — frequentemente jargões/termos do nicho
  if (client.voice_profile?.use?.length) {
    for (const phrase of client.voice_profile.use) {
      const tokens = tokenize(phrase);
      // Pega bigramas se houver, senão tokens isolados longos
      const bg = tokens.length >= 2 ? [tokens.slice(0, 2).join(" ")] : tokens.filter((t) => t.length >= 5);
      bg.forEach((s) => out.add(s));
    }
  }

  // 3. identity_guide — termos repetidos
  const corpus = `${client.identity_guide ?? ""}\n${client.description ?? ""}`;
  if (corpus.trim()) {
    // Bigramas mais frequentes (usually capturam expressões do nicho)
    const bgRanked = rank(bigrams(corpus)).slice(0, 4);
    bgRanked.forEach((s) => out.add(s));
    // Tokens isolados mais frequentes (com >=5 chars pra evitar palavras curtas)
    const tkRanked = rank(tokenize(corpus).filter((t) => t.length >= 5)).slice(0, 6);
    tkRanked.forEach((s) => out.add(s));
  }

  return Array.from(out).slice(0, MAX_KEYWORDS);
}

/** Carrega o cliente direto do supabase pra extrair sugestões. */
export async function fetchSuggestedKeywords(clientId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("description, identity_guide, tags, voice_profile")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return [];
  return suggestKeywordsFromProfile(data as ClientProfileLike);
}
