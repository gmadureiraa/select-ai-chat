/**
 * Seed das tabelas format_specs (Camada 1) + client_format_standards (Camada 2)
 * a partir dos specs em `vault/99 - SISTEMA/format-standards/`.
 *
 * Idempotente: upsert (PK / UNIQUE (client_id, format_id)) — roda 2x sem duplicar.
 * Tolera campos extras no frontmatter — só extrai os conhecidos.
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   bunx tsx scripts/seed-format-standards.ts
 *
 *   # ou:
 *   DATABASE_URL=... bunx tsx scripts/seed-format-standards.ts
 *
 * Variáveis ENV:
 *   DATABASE_URL   — Neon connection string (obrigatória)
 *   DRY_RUN        — "1" loga o que faria sem escrever (opcional)
 *   VAULT_BASE     — override do caminho base (default = workspace Gabriel)
 *
 * Não faz deploy nem push. Só popula DB.
 */

import { Pool } from "@neondatabase/serverless";
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";

const VAULT_BASE =
  process.env.VAULT_BASE ||
  "/Users/gabrielmadureira/GOS/vault/99 - SISTEMA/format-standards";
const FORMATS_DIR = path.join(VAULT_BASE, "formats");
const CLIENTS_DIR = path.join(VAULT_BASE, "clients");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed] DATABASE_URL ausente em env.");
  process.exit(1);
}

const DRY = process.env.DRY_RUN === "1";

// =====================================================
// Helpers
// =====================================================
function readMarkdownWithFrontmatter(filePath: string): {
  frontmatter: Record<string, any>;
  body: string;
} {
  const raw = fs.readFileSync(filePath, "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  try {
    const fm = yaml.load(m[1]) as Record<string, any> | null;
    return { frontmatter: fm || {}, body: m[2].trim() };
  } catch (e) {
    console.error(`[seed] YAML parse falhou em ${filePath}:`, e);
    return { frontmatter: {}, body: m[2]?.trim() ?? "" };
  }
}

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        // Skip metadados sem spec
        const base = entry.name;
        if (
          base.startsWith("_INDEX") ||
          base.startsWith("_DORMANT") ||
          base.startsWith("_inativos") ||
          base.toLowerCase() === "readme.md"
        ) {
          continue;
        }
        out.push(p);
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function pickFirst<T = any>(...vals: T[]): T | null {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function extractSection(body: string, headingRegex: RegExp): string | null {
  // Extrai conteúdo de seção markdown (## Heading) até a próxima H2/H3.
  const lines = body.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim() || null;
}

function buildSystemPromptHints(fm: Record<string, any>, body: string): string {
  // Junta seções 1-7 do MD da Camada 1 num bloco condensado pra injeção.
  // Estrutura padrão: ## 1. O que é / ## 2. Restrições técnicas / ## 3. Arquitetura
  //                   ## 4. KPIs / ## 5. Regras universais anti-flop / ## 6. Ganchos
  //                   ## 7. Como o KAI chat usa esse spec
  const sections = [
    extractSection(body, /^##\s+2\.\s+Restri/i),
    extractSection(body, /^##\s+3\.\s+Arquitetura/i),
    extractSection(body, /^##\s+5\.\s+Regras universais/i),
    extractSection(body, /^##\s+7\.\s+Como o KAI/i),
  ].filter(Boolean);
  return sections.join("\n\n").slice(0, 8000);
}

// =====================================================
// Client slug → clients.id mapping
// =====================================================
// Os specs no vault usam slug ("madureira", "defiverso"). A tabela `clients`
// no Neon usa `name` (text) como identifier humano. Mapping abaixo é
// canônico — adicione clientes novos aqui se aparecerem no vault.
const CLIENT_SLUG_TO_NAME: Record<string, string[]> = {
  madureira: ["Madureira"],
  defiverso: ["Defiverso"],
  // Lucas Amendola hoje NÃO existe como row separada — está coberto por "Defiverso".
  // Se rodarmos contra Defiverso, vai colidir com specs do próprio Defiverso (UNIQUE).
  // Mantemos sem fallback explícito — seed reporta como unknown_client e Gabriel decide:
  //   (a) criar row "Lucas Amendola" em clients (recomendado — perfil pessoal distinto)
  //   (b) renomear os 7 specs Lucas pra defiverso/* e merge manual
  "lucas-amendola": ["Lucas Amendola"],
  dsec: ["DSEC Labs", "DSEC", "D-Sec Labs"],
  "layla-foz": ["Laylä Föz", "Layla Foz", "Layla", "Laylä"],
  "hugo-doria": ["Hugo Doria", "Hugo"],
  // Kaleidos marca = row "Kaleidos" no DB (institucional vs cliente Madureira).
  "kaleidos-marca": ["Kaleidos", "Kaleidos Marca"],
};

async function resolveClientId(
  pool: Pool,
  slug: string,
): Promise<{ id: string | null; matchedName: string | null }> {
  const candidates = CLIENT_SLUG_TO_NAME[slug] ?? [slug];
  for (const name of candidates) {
    const r = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM public.clients WHERE lower(name) = lower($1) LIMIT 1`,
      [name],
    );
    if (r.rows.length > 0) return { id: r.rows[0].id, matchedName: r.rows[0].name };
  }
  return { id: null, matchedName: null };
}

// =====================================================
// Camada 1: format_specs
// =====================================================
async function seedFormatSpecs(pool: Pool): Promise<{
  inserted: number;
  updated: number;
  skipped: { path: string; reason: string }[];
}> {
  const files = listMarkdownFiles(FORMATS_DIR);
  let inserted = 0;
  let updated = 0;
  const skipped: { path: string; reason: string }[] = [];

  for (const file of files) {
    const { frontmatter: fm, body } = readMarkdownWithFrontmatter(file);
    const formatId = fm.format_id as string | undefined;
    if (!formatId) {
      skipped.push({ path: file, reason: "frontmatter sem format_id" });
      continue;
    }

    const platform = (fm.platform as string) || "";
    if (
      !["instagram", "twitter", "linkedin", "email", "blog", "youtube"].includes(
        platform,
      )
    ) {
      skipped.push({
        path: file,
        reason: `platform inválida: "${platform}"`,
      });
      continue;
    }

    const row = {
      format_id: formatId,
      format_name: (fm.format_name as string) || formatId,
      platform,
      content_type: (fm.content_type as string) || "post",
      canvas: fm.canvas ?? {},
      length_unit: (fm.length_unit as string) || "chars",
      length_min: typeof fm.length_min === "number" ? fm.length_min : null,
      length_max: typeof fm.length_max === "number" ? fm.length_max : null,
      length_target:
        typeof fm.length_target === "number" ? fm.length_target : null,
      default_kpi: (fm.default_kpi as string) || null,
      secondary_kpis: Array.isArray(fm.secondary_kpis)
        ? fm.secondary_kpis
        : [],
      cadence_typical: (fm.cadence_typical as string) || null,
      asset_pipeline: (fm.asset_pipeline as string) || null,
      system_prompt_hints: buildSystemPromptHints(fm, body),
      body_markdown: body,
      schema_version: (fm.schema_version as number) || 1,
    };

    if (DRY) {
      console.log(`[DRY] format_specs upsert: ${formatId}`);
      inserted++;
      continue;
    }

    const r = await pool.query<{ inserted: boolean }>(
      `
      INSERT INTO public.format_specs (
        format_id, format_name, platform, content_type, canvas, length_unit,
        length_min, length_max, length_target, default_kpi, secondary_kpis,
        cadence_typical, asset_pipeline, system_prompt_hints, body_markdown,
        schema_version
      ) VALUES (
        $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      ON CONFLICT (format_id) DO UPDATE SET
        format_name         = EXCLUDED.format_name,
        platform            = EXCLUDED.platform,
        content_type        = EXCLUDED.content_type,
        canvas              = EXCLUDED.canvas,
        length_unit         = EXCLUDED.length_unit,
        length_min          = EXCLUDED.length_min,
        length_max          = EXCLUDED.length_max,
        length_target       = EXCLUDED.length_target,
        default_kpi         = EXCLUDED.default_kpi,
        secondary_kpis      = EXCLUDED.secondary_kpis,
        cadence_typical     = EXCLUDED.cadence_typical,
        asset_pipeline      = EXCLUDED.asset_pipeline,
        system_prompt_hints = EXCLUDED.system_prompt_hints,
        body_markdown       = EXCLUDED.body_markdown,
        schema_version      = EXCLUDED.schema_version,
        updated_at          = now()
      RETURNING (xmax = 0) AS inserted
      `,
      [
        row.format_id,
        row.format_name,
        row.platform,
        row.content_type,
        JSON.stringify(row.canvas),
        row.length_unit,
        row.length_min,
        row.length_max,
        row.length_target,
        row.default_kpi,
        row.secondary_kpis,
        row.cadence_typical,
        row.asset_pipeline,
        row.system_prompt_hints,
        row.body_markdown,
        row.schema_version,
      ],
    );
    if (r.rows[0]?.inserted) inserted++;
    else updated++;
    console.log(
      `[seed] format_specs ${r.rows[0]?.inserted ? "INSERTED" : "UPDATED"}: ${formatId}`,
    );
  }

  return { inserted, updated, skipped };
}

// =====================================================
// Camada 2: client_format_standards
// =====================================================
async function seedClientFormatStandards(pool: Pool): Promise<{
  inserted: number;
  updated: number;
  skipped: { path: string; reason: string }[];
  perClient: Record<string, number>;
  rendererTemplatesUsed: Set<string>;
  unknownClients: Set<string>;
}> {
  const files = listMarkdownFiles(CLIENTS_DIR);
  let inserted = 0;
  let updated = 0;
  const skipped: { path: string; reason: string }[] = [];
  const perClient: Record<string, number> = {};
  const rendererTemplatesUsed = new Set<string>();
  const unknownClients = new Set<string>();

  // Cache slug → uuid
  const slugCache = new Map<string, string | null>();

  for (const file of files) {
    const { frontmatter: fm, body } = readMarkdownWithFrontmatter(file);
    const clientSlug = fm.client_id as string | undefined;
    const formatId = fm.format_id as string | undefined;

    if (!clientSlug || !formatId) {
      skipped.push({
        path: file,
        reason: `frontmatter sem client_id/format_id`,
      });
      continue;
    }

    // Resolve client UUID (skipped em DRY_RUN — usa placeholder)
    let clientUuid = slugCache.get(clientSlug) ?? null;
    if (!slugCache.has(clientSlug)) {
      if (DRY) {
        clientUuid = `dry-uuid-${clientSlug}`;
        slugCache.set(clientSlug, clientUuid);
      } else {
        const r = await resolveClientId(pool, clientSlug);
        clientUuid = r.id;
        slugCache.set(clientSlug, clientUuid);
        if (clientUuid) {
          console.log(
            `[seed] client_id resolved: ${clientSlug} → ${clientUuid} (matched name: ${r.matchedName})`,
          );
        } else {
          console.warn(
            `[seed] WARN: client slug não encontrado em clients table: ${clientSlug}`,
          );
        }
      }
    }
    if (!clientUuid) {
      unknownClients.add(clientSlug);
      skipped.push({
        path: file,
        reason: `client_id "${clientSlug}" não existe na tabela clients (precisa criar antes)`,
      });
      continue;
    }

    // Format_id existe? — pula em DRY (sem DB).
    if (!DRY) {
      const fmtCheck = await pool.query(
        `SELECT 1 FROM public.format_specs WHERE format_id = $1`,
        [formatId],
      );
      if (fmtCheck.rowCount === 0) {
        skipped.push({
          path: file,
          reason: `format_id "${formatId}" não existe em format_specs (Camada 1 precisa rodar antes)`,
        });
        continue;
      }
    }

    const status =
      typeof fm.status === "string" ? fm.status.toLowerCase() : "ativo";

    const renderer = (fm.renderer_template as string) || null;
    if (renderer) rendererTemplatesUsed.add(renderer);

    // Soft KAI chat blocks: tentar extrair seções específicas se o agente
    // colocou hard_constraints / soft_preferences no body markdown.
    const hard =
      extractSection(body, /^##\s+(hard[_\s-]?constraints|REGRAS DURAS|Anti-padr)/i) ||
      null;
    const soft =
      extractSection(body, /^##\s+(soft[_\s-]?preferences|Soft preferences)/i) ||
      null;

    const row = {
      client_id: clientUuid,
      format_id: formatId,
      status,
      cadence_actual: (fm.cadence_actual as string) || null,
      schedule_window: fm.schedule_window ?? null,
      renderer_template: renderer,
      voice_overrides: fm.voice_overrides ?? {},
      pillar_distribution: fm.pillar_distribution ?? {},
      cta_template: fm.cta_template ?? {},
      kpi_overrides: fm.kpi_overrides ?? {},
      disclaimers: Array.isArray(fm.disclaimers) ? fm.disclaimers : [],
      hard_constraints: fm.hard_constraints ?? {},
      examples_validated: Array.isArray(fm.examples_validated)
        ? fm.examples_validated
        : [],
      examples_rejected: Array.isArray(fm.examples_rejected)
        ? fm.examples_rejected
        : [],
      body_markdown: body,
      kai_chat_hard_constraints: hard,
      kai_chat_soft_preferences: soft,
      source_path: file,
      last_reviewed: (fm.last_reviewed as string) || null,
      schema_version: (fm.schema_version as number) || 1,
    };

    if (DRY) {
      console.log(
        `[DRY] client_format_standards upsert: ${clientSlug} × ${formatId} (status=${status})`,
      );
      inserted++;
      perClient[clientSlug] = (perClient[clientSlug] ?? 0) + 1;
      continue;
    }

    const r = await pool.query<{ inserted: boolean }>(
      `
      INSERT INTO public.client_format_standards (
        client_id, format_id, status, cadence_actual, schedule_window,
        renderer_template, voice_overrides, pillar_distribution, cta_template,
        kpi_overrides, disclaimers, hard_constraints,
        examples_validated, examples_rejected, body_markdown,
        kai_chat_hard_constraints, kai_chat_soft_preferences,
        source_path, last_reviewed, schema_version
      ) VALUES (
        $1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
        $11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20
      )
      ON CONFLICT (client_id, format_id) DO UPDATE SET
        status                    = EXCLUDED.status,
        cadence_actual            = EXCLUDED.cadence_actual,
        schedule_window           = EXCLUDED.schedule_window,
        renderer_template         = EXCLUDED.renderer_template,
        voice_overrides           = EXCLUDED.voice_overrides,
        pillar_distribution       = EXCLUDED.pillar_distribution,
        cta_template              = EXCLUDED.cta_template,
        kpi_overrides             = EXCLUDED.kpi_overrides,
        disclaimers               = EXCLUDED.disclaimers,
        hard_constraints          = EXCLUDED.hard_constraints,
        examples_validated        = EXCLUDED.examples_validated,
        examples_rejected         = EXCLUDED.examples_rejected,
        body_markdown             = EXCLUDED.body_markdown,
        kai_chat_hard_constraints = EXCLUDED.kai_chat_hard_constraints,
        kai_chat_soft_preferences = EXCLUDED.kai_chat_soft_preferences,
        source_path               = EXCLUDED.source_path,
        last_reviewed             = EXCLUDED.last_reviewed,
        schema_version            = EXCLUDED.schema_version,
        updated_at                = now()
      RETURNING (xmax = 0) AS inserted
      `,
      [
        row.client_id,
        row.format_id,
        row.status,
        row.cadence_actual,
        row.schedule_window ? JSON.stringify(row.schedule_window) : null,
        row.renderer_template,
        JSON.stringify(row.voice_overrides),
        JSON.stringify(row.pillar_distribution),
        JSON.stringify(row.cta_template),
        JSON.stringify(row.kpi_overrides),
        row.disclaimers,
        JSON.stringify(row.hard_constraints),
        JSON.stringify(row.examples_validated),
        JSON.stringify(row.examples_rejected),
        row.body_markdown,
        row.kai_chat_hard_constraints,
        row.kai_chat_soft_preferences,
        row.source_path,
        row.last_reviewed,
        row.schema_version,
      ],
    );
    if (r.rows[0]?.inserted) inserted++;
    else updated++;
    perClient[clientSlug] = (perClient[clientSlug] ?? 0) + 1;
    console.log(
      `[seed] cfs ${r.rows[0]?.inserted ? "INSERTED" : "UPDATED"}: ${clientSlug} × ${formatId}`,
    );
  }

  return {
    inserted,
    updated,
    skipped,
    perClient,
    rendererTemplatesUsed,
    unknownClients,
  };
}

// =====================================================
// Main
// =====================================================
async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    console.log(`[seed] DRY_RUN=${DRY ? "1" : "0"}`);
    console.log(`[seed] VAULT_BASE=${VAULT_BASE}`);
    console.log("[seed] Camada 1 (format_specs)...");
    const fs1 = await seedFormatSpecs(pool);
    console.log(
      `[seed] format_specs: inserted=${fs1.inserted} updated=${fs1.updated} skipped=${fs1.skipped.length}`,
    );
    for (const s of fs1.skipped) console.log(`        SKIP: ${s.path} — ${s.reason}`);

    console.log("[seed] Camada 2 (client_format_standards)...");
    const fs2 = await seedClientFormatStandards(pool);
    console.log(
      `[seed] cfs: inserted=${fs2.inserted} updated=${fs2.updated} skipped=${fs2.skipped.length}`,
    );
    for (const s of fs2.skipped) console.log(`        SKIP: ${s.path} — ${s.reason}`);

    console.log("\n=== Summary ===");
    console.log("Per client:");
    for (const [slug, n] of Object.entries(fs2.perClient).sort()) {
      console.log(`  ${slug}: ${n}`);
    }
    if (fs2.unknownClients.size > 0) {
      console.log("\nUnknown client slugs (precisam ser criados em clients):");
      for (const slug of fs2.unknownClients) console.log(`  - ${slug}`);
    }
    if (fs2.rendererTemplatesUsed.size > 0) {
      console.log("\nRenderer templates referenciados:");
      for (const r of fs2.rendererTemplatesUsed) console.log(`  - ${r}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[seed] erro fatal:", e);
  process.exit(1);
});
