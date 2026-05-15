/**
 * Carregamento de spec (cliente × formato) pra injeção no system prompt do KAI chat.
 * Fonte: tabelas `format_specs` + `client_format_standards` (migration 0040).
 *
 * Não substitui o sistema antigo `format-rules.ts` (que injeta regras genéricas
 * por keyword detectada na message). Esse helper é ENRIQUECIMENTO: quando o
 * caller souber clientId + formatId, carrega o spec específico e prepende
 * regras duras + voz + estrutura no system prompt.
 *
 * Se clientId/formatId não tiverem ou se o spec não existir no DB, retorna null
 * e o caller mantém o fluxo default.
 */

import { query, queryOne } from "../db.js";

export interface FormatStandardRow {
  standard_id: string;
  client_id: string;
  client_name: string;
  workspace_id: string;
  format_id: string;
  format_name: string;
  platform: string;
  content_type: string;
  canvas: Record<string, unknown> | null;
  length_unit: string;
  length_min: number | null;
  length_max: number | null;
  length_target: number | null;
  default_kpi: string | null;
  secondary_kpis: string[] | null;
  cadence_typical: string | null;
  asset_pipeline: string | null;
  system_prompt_hints: string | null;
  format_body_markdown: string | null;
  status: string;
  cadence_actual: string | null;
  schedule_window: unknown;
  renderer_template: string | null;
  voice_overrides: Record<string, unknown> | null;
  pillar_distribution: Record<string, unknown> | null;
  cta_template: Record<string, unknown> | null;
  kpi_overrides: Record<string, unknown> | null;
  disclaimers: string[] | null;
  hard_constraints: Record<string, unknown> | null;
  examples_validated: Array<Record<string, unknown>> | null;
  examples_rejected: Array<Record<string, unknown>> | null;
  client_body_markdown: string | null;
  kai_chat_hard_constraints: string | null;
  kai_chat_soft_preferences: string | null;
  source_path: string | null;
  last_reviewed: string | null;
  schema_version: number;
}

/**
 * Mapping de "format key" usado pelo KAI chat (tweet, thread, carrossel, …)
 * pro format_id canônico no `format_specs`. Cobre tanto:
 *   - chaves detectadas via CONTENT_FORMAT_KEYWORDS (PT/EN curtas)
 *   - chaves usadas em CONTENT_TYPE_MAP (longas tipo `linkedin_post`, `viral_carousel`)
 *
 * Quando o KAI chat detectar format por keyword na message, esse map traduz
 * pra format_id do schema novo.
 */
const FORMAT_KEY_TO_ID: Record<string, string> = {
  // Twitter / X
  tweet: "x-single",
  x_single: "x-single",
  thread: "x-thread",
  x_thread: "x-thread",
  // Instagram
  carrossel: "ig-carrossel-1080x1350",
  carousel: "ig-carrossel-1080x1350",
  viral_carousel: "ig-carrossel-1080x1350",
  ig_carrossel: "ig-carrossel-1080x1350",
  reels: "ig-reels-9x16",
  short_video: "ig-reels-9x16",
  ig_reels: "ig-reels-9x16",
  stories: "ig-story-1080x1920",
  story: "ig-story-1080x1920",
  ig_story: "ig-story-1080x1920",
  // LinkedIn
  linkedin: "linkedin-post",
  linkedin_post: "linkedin-post",
  linkedin_carrossel: "linkedin-carrossel",
  linkedin_carousel: "linkedin-carrossel",
  // Newsletter / blog / longform
  newsletter: "newsletter",
  email_marketing: "newsletter",
  blog: "blog-longform",
  blog_post: "blog-longform",
  x_article: "blog-longform",
  // YouTube
  long_video: "youtube-script",
  youtube_script: "youtube-script",
  youtube: "youtube-script",
};

export function resolveFormatId(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  // Já é format_id canônico?
  if (key.includes("-")) return key;
  return FORMAT_KEY_TO_ID[key] ?? null;
}

/**
 * Carrega o spec completo (Camada 1 + Camada 2) numa query só via view.
 * Retorna null se não houver row pra esse (clientId, formatId).
 */
export async function loadFormatStandard(
  clientId: string,
  formatIdOrKey: string,
): Promise<FormatStandardRow | null> {
  const formatId = resolveFormatId(formatIdOrKey);
  if (!formatId) return null;
  try {
    const row = await queryOne<FormatStandardRow>(
      `SELECT * FROM public.v_client_format_full WHERE client_id = $1 AND format_id = $2`,
      [clientId, formatId],
    );
    return row ?? null;
  } catch (err) {
    // Tabela pode ainda não existir em ambientes que não rodaram migration 0040.
    // Logamos e retornamos null pro fluxo default.
    console.warn(
      `[format-standards] loadFormatStandard falhou (clientId=${clientId} formatId=${formatId}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Carrega só a Camada 1 (format_specs) por format_id, sem cliente.
 * Útil quando o KAI chat precisa de fallback genérico.
 */
export async function loadFormatSpec(
  formatIdOrKey: string,
): Promise<{
  format_id: string;
  format_name: string;
  platform: string;
  content_type: string;
  canvas: Record<string, unknown> | null;
  length_unit: string;
  length_min: number | null;
  length_max: number | null;
  length_target: number | null;
  default_kpi: string | null;
  secondary_kpis: string[] | null;
  system_prompt_hints: string | null;
} | null> {
  const formatId = resolveFormatId(formatIdOrKey);
  if (!formatId) return null;
  try {
    return (
      (await queryOne(
        `SELECT format_id, format_name, platform, content_type, canvas, length_unit,
                length_min, length_max, length_target, default_kpi, secondary_kpis,
                system_prompt_hints
         FROM public.format_specs WHERE format_id = $1`,
        [formatId],
      )) ?? null
    );
  } catch (err) {
    console.warn(
      `[format-standards] loadFormatSpec falhou (formatId=${formatId}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// =====================================================
// Builders de bloco markdown pro system prompt
// =====================================================

function bulletList(items: unknown, prefix = "  - "): string {
  if (!items) return "";
  const arr = Array.isArray(items) ? items : [items];
  return arr
    .map((x) => {
      if (typeof x === "string") return `${prefix}${x}`;
      try {
        return `${prefix}${JSON.stringify(x)}`;
      } catch {
        return `${prefix}${String(x)}`;
      }
    })
    .join("\n");
}

function safeJoin(items: unknown, sep = ", "): string {
  if (!items) return "";
  const arr = Array.isArray(items) ? items : [items];
  return arr
    .filter((x) => x !== null && x !== undefined && x !== "")
    .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
    .join(sep);
}

function extractClientCanonicalStructure(body: string | null): string | null {
  if (!body) return null;
  const m = body.match(
    /^##\s+(Estrutura\s+can[oô]nica|Estrutura)\s*[\r\n]+([\s\S]*?)(?=^##\s|\Z)/im,
  );
  return m ? m[2].trim() : null;
}

function extractAntiPatterns(body: string | null): string | null {
  if (!body) return null;
  const m = body.match(
    /^##\s+(Anti-padr(o|õ)es[^\r\n]*|Anti[\-\s]?padr|REGRAS DURAS)\s*[\r\n]+([\s\S]*?)(?=^##\s|\Z)/im,
  );
  return m ? m[3].trim() : null;
}

/**
 * Monta o bloco markdown que vai ser prependido ao system prompt do KAI chat.
 * Em ~2-4k chars condensa:
 *   - hard constraints (voz banida, canvas, length, hard_constraints YAML)
 *   - voz characteristic (tone_markers + required_marks)
 *   - estrutura canônica (extraída do body_markdown da Camada 2)
 *   - CTA (cta_template)
 *   - anti-padrões (extraída do body)
 *   - few-shot: top 3 examples_validated
 */
export function buildFormatSystemPrompt(spec: FormatStandardRow): string {
  const lines: string[] = [];
  lines.push(
    `## REGRAS DO FORMATO (${spec.format_name} pra ${spec.client_name})`,
  );
  lines.push("");
  lines.push(`Status: ${spec.status}  ·  cadência: ${spec.cadence_actual || spec.cadence_typical || "n/d"}`);
  if (spec.renderer_template) {
    lines.push(`Renderer template: \`${spec.renderer_template}\``);
  }

  // Hard constraints
  lines.push("");
  lines.push("### Hard constraints (NÃO PODE VIOLAR)");
  const canvasStr =
    spec.canvas && (spec.canvas as Record<string, unknown>).dimensions
      ? String((spec.canvas as Record<string, unknown>).dimensions)
      : "n/d";
  lines.push(`- Canvas: ${canvasStr}`);
  if (spec.length_min || spec.length_max) {
    lines.push(
      `- Length: ${spec.length_min ?? "?"}–${spec.length_max ?? "?"} ${spec.length_unit}` +
        (spec.length_target ? ` (target ${spec.length_target})` : ""),
    );
  }
  const vo = spec.voice_overrides ?? {};
  const banned = (vo as Record<string, unknown>).banned_phrases as unknown;
  const bannedWords = (vo as Record<string, unknown>).banned_words as unknown;
  const bannedPunct = (vo as Record<string, unknown>).banned_punctuation as unknown;
  if (banned) lines.push(`- Frases banidas: ${safeJoin(banned)}`);
  if (bannedWords) lines.push(`- Palavras banidas: ${safeJoin(bannedWords)}`);
  if (bannedPunct) lines.push(`- Pontuação banida: ${safeJoin(bannedPunct)}`);

  const hcObj = spec.hard_constraints ?? {};
  const hcKeys = Object.keys(hcObj as Record<string, unknown>);
  if (hcKeys.length > 0) {
    lines.push("- Outras restrições:");
    for (const k of hcKeys) {
      const v = (hcObj as Record<string, unknown>)[k];
      lines.push(`  - ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }

  // Voz
  const tone = (vo as Record<string, unknown>).tone_markers as unknown;
  const required = (vo as Record<string, unknown>).required_marks as unknown;
  if (tone || required) {
    lines.push("");
    lines.push("### Voz characteristic");
    if (tone) {
      lines.push("Tone markers:");
      lines.push(bulletList(tone));
    }
    if (required) {
      lines.push("Required marks (precisam aparecer):");
      lines.push(bulletList(required));
    }
  }

  // Estrutura canônica (extraída do body markdown)
  const struct = extractClientCanonicalStructure(spec.client_body_markdown);
  if (struct) {
    lines.push("");
    lines.push("### Estrutura canônica");
    lines.push(struct.length > 2000 ? struct.slice(0, 2000) + "…" : struct);
  }

  // CTA
  const cta = spec.cta_template ?? {};
  const ctaKeys = Object.keys(cta as Record<string, unknown>);
  if (ctaKeys.length > 0) {
    lines.push("");
    lines.push("### CTA");
    for (const k of ctaKeys) {
      const v = (cta as Record<string, unknown>)[k];
      const valStr = typeof v === "string" ? v : JSON.stringify(v);
      lines.push(`- ${k}: ${valStr.length > 400 ? valStr.slice(0, 400) + "…" : valStr}`);
    }
  }

  // Anti-padrões
  const anti = extractAntiPatterns(spec.client_body_markdown);
  if (anti) {
    lines.push("");
    lines.push("### Anti-padrões (NÃO faça)");
    lines.push(anti.length > 1500 ? anti.slice(0, 1500) + "…" : anti);
  }

  // KPIs
  if (spec.default_kpi || spec.kpi_overrides) {
    lines.push("");
    lines.push("### KPIs alvo");
    if (spec.default_kpi) lines.push(`- Default KPI: ${spec.default_kpi}`);
    if (spec.secondary_kpis && spec.secondary_kpis.length > 0) {
      lines.push(`- Secondary KPIs: ${spec.secondary_kpis.join(", ")}`);
    }
    if (
      spec.kpi_overrides &&
      Object.keys(spec.kpi_overrides as Record<string, unknown>).length > 0
    ) {
      lines.push(`- Override por cliente: ${JSON.stringify(spec.kpi_overrides)}`);
    }
  }

  // Few-shot (até 3 validated)
  if (
    spec.examples_validated &&
    Array.isArray(spec.examples_validated) &&
    spec.examples_validated.length > 0
  ) {
    lines.push("");
    lines.push("### Few-shot (referências aprovadas)");
    const top = spec.examples_validated.slice(0, 3) as Array<{
      title?: string;
      why_works?: string;
      ref?: string;
    }>;
    top.forEach((ex, i) => {
      lines.push(`${i + 1}. ${ex.title || "(sem título)"}`);
      if (ex.why_works) lines.push(`   Por que funciona: ${ex.why_works}`);
    });
  }

  // Disclaimers
  if (spec.disclaimers && spec.disclaimers.length > 0) {
    lines.push("");
    lines.push("### Disclaimers obrigatórios");
    lines.push(bulletList(spec.disclaimers));
  }

  // Fonte
  if (spec.source_path) {
    lines.push("");
    lines.push(`_Fonte: ${spec.source_path} (schema v${spec.schema_version})_`);
  }

  return lines.join("\n");
}

/**
 * Wrapper conveniente: carrega + monta + retorna o bloco final.
 * Retorna string vazia se não houver spec ou falhar — caller só faz
 * `systemPrompt += await loadAndBuildFormatPrompt(clientId, format)`.
 */
export async function loadAndBuildFormatPrompt(
  clientId: string | null | undefined,
  formatKey: string | null | undefined,
): Promise<string> {
  if (!clientId || !formatKey) return "";
  const spec = await loadFormatStandard(clientId, formatKey);
  if (!spec) return "";
  return "\n" + buildFormatSystemPrompt(spec) + "\n";
}
