/**
 * parse-llm-response — helpers defensivos pra processar output de LLM
 * antes de salvar/devolver pro usuário.
 *
 * Por que existe (bugs reportados Gabriel 2026-05-16):
 *   - Texto de post LinkedIn saiu "todo bugado" no KAI Chat.
 *   - Causas possíveis observadas no codebase:
 *       1. Gemini às vezes envolve o output em ```json ... ``` ou ```markdown ... ```
 *          mesmo quando o prompt pede texto puro. Isso vaza pro corpo final.
 *       2. UTF-8 mojibake (ã → Ã£, é → Ã©) quando o byte-stream é parsed sem
 *          forçar charset.
 *       3. Caracteres de controle (BOM, zero-width, NBSP fantasma) entram no
 *          texto por copy/paste do prompt do user e poluem o output.
 *       4. Linhas com "Aqui está o post:" ou "Segue o conteúdo:" voltam mesmo
 *          com a regra UNIVERSAL_OUTPUT_RULES proibindo (Gemini erra na borda).
 *       5. Hashtags em LinkedIn (a regra é zero) ou hashtags em massa em outras
 *          plataformas. Quality-rules detecta mas não remove — só sinaliza.
 *
 * Esse módulo é responsabilidade ÚNICA: limpar/validar a string crua do LLM
 * antes de qualquer persistência ou retorno ao client. Funções puras.
 */

// ─── Constantes ─────────────────────────────────────────────────────────

const ZERO_WIDTH = /[​-‍﻿]/g;
const SMART_QUOTES_MAP: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '—': '—', // mantém em-dash (regra editorial), mas garante o codepoint correto
};

// Linhas que indicam meta-texto AI-isms — devem ser removidas se vierem como primeira linha.
const META_PREFIXES: RegExp[] = [
  /^aqui está (?:o |a |sua |seu )?(?:post|conteúdo|texto|carrossel|thread|tweet|newsletter|email)[^:\n]*[:\s]/i,
  /^segue (?:o |a |sua |seu )?(?:post|conteúdo|texto|carrossel|thread|tweet|newsletter|email)[^:\n]*[:\s]/i,
  /^aqui (?:vai|vão)[^:\n]*[:\s]/i,
  /^criei (?:para você|pra você|um|uma)[^:\n]*[:\s]/i,
  /^preparei (?:para você|pra você|um|uma)[^:\n]*[:\s]/i,
  /^segue abaixo[^:\n]*[:\s]/i,
  /^abaixo (?:está|segue)[^:\n]*[:\s]/i,
  /^(?:eis|veja|olha)[^:\n]{0,40}(?:post|conteúdo|texto|carrossel|thread|tweet|newsletter)[^:\n]*[:\s]/i,
];

// Mojibake patterns — sequências UTF-8 que viraram Latin-1 e foram re-encodadas.
// Detectar com pattern `Ã` seguido de char de controle high.
const MOJIBAKE_HINTS = /Ã[¡-¿]|Ã£|Ã©|Ã§|Ãª/;

// ─── Funções públicas ──────────────────────────────────────────────────

/**
 * Strip de fences de markdown que envolvem o output inteiro.
 * Gemini às vezes faz:
 *   ```json
 *   { "post": "..." }
 *   ```
 * ou
 *   ```markdown
 *   # Título
 *   ...
 *   ```
 * mesmo quando o prompt pede texto puro.
 *
 * Estratégia: se a string toda começa+termina com ``` (com qualquer tag), strip.
 * Se houver apenas no início, strip o início. Se houver só fence no fim, strip.
 */
export function stripOuterCodeFence(raw: string): string {
  if (!raw) return raw;
  let trimmed = raw.trim();

  // Aplica até 3 passes pra cobrir o caso double-wrap (`\`\`\`json\n\`\`\`\n...`).
  // Não loop infinito — bound em 3 iterações.
  for (let pass = 0; pass < 3; pass++) {
    const before = trimmed;

    // Padrão 1: ```tag\n...\n``` envolvendo tudo
    const fullFence = /^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```\s*$/;
    const fullMatch = trimmed.match(fullFence);
    if (fullMatch) {
      trimmed = fullMatch[1].trim();
      continue;
    }

    // Padrão 2: ```tag\n``` (fence vazia logo no início) seguido de \n...
    const emptyOpen = /^```[a-zA-Z0-9_-]*\s*\n```\s*\n?/;
    trimmed = trimmed.replace(emptyOpen, '').trim();

    // Padrão 3: ``` no começo (sem fechar)
    const openOnly = /^```[a-zA-Z0-9_-]*\s*\n/;
    trimmed = trimmed.replace(openOnly, '');

    // Padrão 4: ``` no fim
    trimmed = trimmed.replace(/\n```\s*$/, '').trim();

    if (trimmed === before) break; // converged
  }

  return trimmed;
}

/**
 * Tenta extrair JSON puro de uma string que pode estar envolvida em markdown.
 * Retorna `null` se não for JSON parseável.
 *
 * Útil pra tools que esperam JSON estruturado mas o LLM envolveu em ```json.
 */
export function tryParseJsonResponse<T = unknown>(raw: string): T | null {
  const cleaned = stripOuterCodeFence(raw).trim();
  if (!cleaned) return null;
  // Tenta parse direto se começa com { ou [
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Fallthrough pra heurística abaixo
    }
  }
  // Heurística: acha primeira { e última } válidas — útil pra texto com
  // prefixo "Aqui está o JSON: { ... }".
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Detecta se a string contém mojibake (UTF-8 lido como Latin-1).
 * NÃO conserta automaticamente — algumas strings VÁLIDAS em PT podem ter "Ã"
 * (ex: nome de empresa) e a heurística de fix pode quebrar.
 *
 * Caller decide se mostra warning ou descarta.
 */
export function detectMojibake(raw: string): boolean {
  if (!raw) return false;
  return MOJIBAKE_HINTS.test(raw);
}

/**
 * Remove caracteres invisíveis (zero-width, BOM) que poluem o texto.
 * Normaliza smart quotes pra ASCII (mantém em-dash editorial).
 * NÃO mexe em emojis nem acentuação normal.
 */
export function normalizeWhitespaceAndQuotes(raw: string): string {
  if (!raw) return raw;
  let out = raw.replace(ZERO_WIDTH, '');
  for (const [from, to] of Object.entries(SMART_QUOTES_MAP)) {
    out = out.split(from).join(to);
  }
  // Colapsa 3+ newlines em 2 (mantém parágrafos, evita gaps surreais)
  out = out.replace(/\n{3,}/g, '\n\n');
  // Trim trailing spaces por linha
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
  return out.trim();
}

/**
 * Remove a primeira linha se ela for meta-prefixo tipo "Aqui está o post:".
 * Faz UMA passada (não recursivo, pra não pegar conteúdo legítimo que começa com "Aqui").
 */
export function stripMetaPrefix(raw: string): string {
  if (!raw) return raw;
  const lines = raw.split('\n');
  const first = lines[0].trim();
  for (const pattern of META_PREFIXES) {
    if (pattern.test(first)) {
      // Verificar se a linha após meta tem conteúdo (não é continuação)
      // Tira a primeira linha e qualquer linha vazia que sobrou.
      lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
      return lines.join('\n').trim();
    }
  }
  return raw;
}

/**
 * Remove hashtags do texto. Use quando a plataforma proíbe (LinkedIn no padrão Madureira)
 * ou quando o spec do cliente limita hashtags a zero.
 *
 * Mantém menções (@user) — apaga apenas tokens #palavra.
 */
export function stripHashtags(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/(^|\s)#[\p{L}0-9_]+/gu, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Limita hashtags a `maxCount`. Mantém as primeiras N, remove as outras.
 */
export function limitHashtags(raw: string, maxCount: number): string {
  if (!raw || maxCount < 0) return raw;
  const hashtagRegex = /#[\p{L}0-9_]+/gu;
  let kept = 0;
  return raw.replace(hashtagRegex, (match) => {
    kept += 1;
    return kept <= maxCount ? match : '';
  })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// ─── Title extraction helpers (compartilhados createContent/editContent) ─

/**
 * Extrai um título limpo do conteúdo gerado, removendo prefixos markdown
 * (`# Header`), labels do estilo `**Hook:**`/`**Gancho:**` e collapsing whitespace.
 *
 * Usado pra preencher `planning_items.title` (max 60 chars).
 */
export function extractTitleFromContent(content: string, maxLen = 60): string {
  if (!content) return '';
  // Primeiro: tira fences que envolvam o conteúdo inteiro.
  // Depois rejeita linhas que SÃO fence interno (```js, ```json sem fechar).
  // E rejeita linhas dentro de fence interno (heurística: até achar uma
  // linha sem fence aberto/fechado).
  let inFence = false;
  const stripped = stripOuterCodeFence(content);
  const firstNonMeta = stripped
    .split('\n')
    .map((l) => l.trim())
    .find((l) => {
      if (/^```/.test(l)) {
        // toggle fence state e pula a linha do fence
        inFence = !inFence;
        return false;
      }
      if (inFence) return false;
      if (!l) return false;
      if (/^\*\*(?:hook|gancho|título|title|cta|legenda|caption):\*\*/i.test(l)) {
        return false;
      }
      return true;
    });
  const raw = (firstNonMeta ?? stripped).trim();
  return raw
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

// ─── Pipeline completo ─────────────────────────────────────────────────

export interface SanitizeOptions {
  /** Se true, remove TODAS as hashtags. Default false. */
  stripAllHashtags?: boolean;
  /** Se >=0, limita hashtags a esse número. Aplicado depois de stripAll. */
  maxHashtags?: number;
  /** Se true, loga warning quando mojibake detectado. Default true. */
  warnMojibake?: boolean;
}

export interface SanitizedOutput {
  /** Texto final pronto pra persistir/mostrar. */
  text: string;
  /** Warnings não-fatais detectados (mojibake, fences strippadas, etc). */
  warnings: string[];
}

/**
 * Pipeline canônico de sanitização aplicado em TODO output de LLM antes
 * de salvar em planning_items / responder pro chat.
 *
 * Ordem:
 *   1. Strip outer code fence (```json ou ```markdown envolvendo tudo)
 *   2. Normalize whitespace + smart quotes + zero-width
 *   3. Strip meta-prefixos ("Aqui está o post:")
 *   4. Detect mojibake e warn
 *   5. (Opcional) strip ou limit hashtags
 */
export function sanitizeLLMText(
  raw: string,
  opts: SanitizeOptions = {},
): SanitizedOutput {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'string') {
    return { text: '', warnings: ['empty_or_invalid_input'] };
  }

  const beforeFence = raw;
  let text = stripOuterCodeFence(raw);
  if (text !== beforeFence.trim()) warnings.push('stripped_outer_code_fence');

  text = normalizeWhitespaceAndQuotes(text);

  const beforeMeta = text;
  text = stripMetaPrefix(text);
  if (text !== beforeMeta) warnings.push('stripped_meta_prefix');

  if (opts.warnMojibake !== false && detectMojibake(text)) {
    warnings.push('mojibake_detected');
  }

  if (opts.stripAllHashtags) {
    const before = text;
    text = stripHashtags(text);
    if (text !== before) warnings.push('stripped_all_hashtags');
  } else if (typeof opts.maxHashtags === 'number') {
    const before = text;
    text = limitHashtags(text, opts.maxHashtags);
    if (text !== before) warnings.push(`limited_hashtags_to_${opts.maxHashtags}`);
  }

  return { text: text.trim(), warnings };
}
