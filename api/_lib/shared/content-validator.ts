// Port of supabase/functions/_shared/content-validator.ts
// Parser + Validation + Repair builder for unified-content-api pipeline.

import { getFormatSchema } from './format-schemas.js';
import {
  checkForbiddenPhrases,
  checkMetaText,
  checkHashtags,
  checkStructuralPatterns,
} from './quality-rules.js';

export interface Violation {
  field: string;
  rule:
    | 'max_length'
    | 'min_length'
    | 'required'
    | 'prohibited_word'
    | 'hashtag'
    | 'meta_text'
    | 'forbidden_phrase'
    | 'structural_pattern';
  message: string;
  value?: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  parsed_fields: Record<string, string>;
  warnings: string[];
}

export function parseOutput(content: string, format: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const schema = getFormatSchema(format);

  if (!schema) {
    parsed.content = content.trim();
    return parsed;
  }

  // Strategy 1: **FIELD:** patterns
  const boldFieldPattern = /\*\*([^*]+)\*\*:\s*([^*\n]+(?:\n(?!\*\*)[^\n]*)*)/gi;
  let match: RegExpExecArray | null;
  while ((match = boldFieldPattern.exec(content)) !== null) {
    const fieldLabel = match[1].toLowerCase().trim();
    const fieldValue = match[2].trim();
    const fieldMap: Record<string, string> = {
      assunto: 'subject',
      preview: 'preview',
      'texto principal': 'visual_text',
      'texto do visual': 'visual_text',
      'texto secundário': 'visual_secondary',
      legenda: 'caption',
      cta: 'cta',
      gancho: 'hook',
      título: 'title',
      'meta description': 'meta_description',
      'thumbnail text': 'thumbnail_text',
      'tweet de divulgação': 'promo_tweet',
      'botão cta': 'cta',
    };
    const normalizedField = fieldMap[fieldLabel] || fieldLabel.replace(/\s+/g, '_');
    parsed[normalizedField] = fieldValue;
  }

  // Strategy 2: sections divided by ---
  const sections = content.split(/^---$/m).map((s) => s.trim()).filter(Boolean);
  if (sections.length > 1) {
    if (!parsed.body && sections.length >= 2) {
      const bodyParts = sections.slice(1, -1);
      if (bodyParts.length > 0) parsed.body = bodyParts.join('\n\n').trim();
    }
    const lastSection = sections[sections.length - 1];
    if (lastSection.toLowerCase().includes('legenda:')) {
      const cm = lastSection.match(/legenda:\s*([\s\S]+)/i);
      if (cm && !parsed.caption) parsed.caption = cm[1].trim();
    }
  }

  // Strategy 3: Página X
  const slidePattern = /^Página\s*(\d+):\s*\n([\s\S]*?)(?=^Página|\n---|\n\*\*LEGENDA|$)/gim;
  const slides: string[] = [];
  while ((match = slidePattern.exec(content)) !== null) {
    slides.push(match[2].trim());
  }
  if (slides.length > 0) {
    parsed.cover_headline = slides[0].split('\n')[0].trim();
    if (slides[0].split('\n').length > 1) {
      parsed.cover_subtitle = slides[0].split('\n').slice(1).join('\n').trim();
    }
    if (slides.length > 1) {
      parsed.cta_slide = slides[slides.length - 1];
      parsed.slides = JSON.stringify(slides.slice(1, -1));
    }
  }

  // Strategy 4: Tweet X/Y
  const tweetPattern = /^Tweet\s*(\d+)\/(\d+):\s*\n?([\s\S]*?)(?=^Tweet\s*\d|$)/gim;
  const tweets: string[] = [];
  while ((match = tweetPattern.exec(content)) !== null) {
    tweets.push(match[3].trim());
  }
  if (tweets.length > 0) {
    parsed.hook_tweet = tweets[0];
    parsed.cta_tweet = tweets[tweets.length - 1];
    parsed.content_tweets = JSON.stringify(tweets.slice(1, -1));
  }

  // Strategy 5: Story X
  const storyPattern = /^Story\s*(\d+):\s*\n([\s\S]*?)(?=^Story\s*\d|^---|\n\*\*|$)/gim;
  const stories: string[] = [];
  while ((match = storyPattern.exec(content)) !== null) {
    stories.push(match[2].trim());
  }
  if (stories.length > 0) {
    parsed.stories_content = JSON.stringify(stories);
    parsed.cta_story = stories[stories.length - 1];
  }

  // Strategy 6: ## sections
  const sectionPattern = /^##\s*(.+)\n([\s\S]*?)(?=^##|\n---|\n\*\*[A-Z]|$)/gim;
  const sectionContent: string[] = [];
  while ((match = sectionPattern.exec(content)) !== null) {
    sectionContent.push(match[2].trim());
  }
  if (sectionContent.length > 0 && !parsed.body) {
    parsed.body = sectionContent.join('\n\n');
  }

  if (Object.keys(parsed).length === 0) {
    parsed.content = content.trim();
  }

  return parsed;
}

export function validateContent(
  parsed: Record<string, string>,
  format: string,
  clientAvoidWords?: string[]
): ValidationResult {
  const violations: Violation[] = [];
  const warnings: string[] = [];
  const schema = getFormatSchema(format);

  const fullContent = Object.values(parsed).join('\n');

  if (checkMetaText(fullContent)) {
    violations.push({
      field: '_global',
      rule: 'meta_text',
      message:
        "Conteúdo começa com meta-texto ('Aqui está...', 'Segue...'). Remova e comece diretamente com o conteúdo.",
      severity: 'error',
    });
  }

  const hashtags = checkHashtags(fullContent);
  if (hashtags.length > 0) {
    violations.push({
      field: '_global',
      rule: 'hashtag',
      message: `Hashtags encontradas: ${hashtags.slice(0, 5).join(', ')}. Remova todas as hashtags.`,
      value: hashtags.join(', '),
      severity: 'error',
    });
  }

  const forbiddenFound = checkForbiddenPhrases(fullContent);
  if (forbiddenFound.length > 0) {
    violations.push({
      field: '_global',
      rule: 'forbidden_phrase',
      message: `Frases genéricas de IA encontradas: "${forbiddenFound
        .slice(0, 3)
        .join('", "')}". Reescreva de forma mais natural.`,
      value: forbiddenFound.join(', '),
      severity: 'error',
    });
  }

  const structuralPatterns = checkStructuralPatterns(fullContent);
  if (structuralPatterns.length > 0) {
    violations.push({
      field: '_global',
      rule: 'structural_pattern',
      message: `Padrões estruturais de IA detectados: ${structuralPatterns
        .map((p) => p.description)
        .join('; ')}. Reescreva com estrutura mais natural e variada.`,
      value: structuralPatterns.map((p) => p.name).join(', '),
      severity: 'warning',
    });
  }

  if (clientAvoidWords && clientAvoidWords.length > 0) {
    const clientForbidden: string[] = [];
    const lowerContent = fullContent.toLowerCase();
    for (const word of clientAvoidWords) {
      if (lowerContent.includes(word.toLowerCase())) clientForbidden.push(word);
    }
    if (clientForbidden.length > 0) {
      violations.push({
        field: '_client_voice',
        rule: 'prohibited_word',
        message: `Palavras na lista "Evite" do cliente: "${clientForbidden.join('", "')}". Use alternativas.`,
        value: clientForbidden.join(', '),
        severity: 'warning',
      });
    }
  }

  if (schema) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      if (fieldSchema.required && !parsed[fieldName]) {
        violations.push({
          field: fieldName,
          rule: 'required',
          message: `Campo obrigatório "${fieldName}" não encontrado. ${fieldSchema.description}`,
          severity: 'error',
        });
      }
      if (parsed[fieldName]) {
        const value = parsed[fieldName];
        const charCount = value.length;
        if (fieldSchema.max_length && charCount > fieldSchema.max_length) {
          violations.push({
            field: fieldName,
            rule: 'max_length',
            message: `Campo "${fieldName}" excede limite: ${charCount}/${fieldSchema.max_length} caracteres.`,
            value: value.substring(0, 100) + '...',
            severity: 'error',
          });
        }
        if (fieldSchema.min_length && charCount < fieldSchema.min_length) {
          violations.push({
            field: fieldName,
            rule: 'min_length',
            message: `Campo "${fieldName}" muito curto: ${charCount}/${fieldSchema.min_length} caracteres mínimos.`,
            value: value.substring(0, 100),
            severity: 'warning',
          });
        }
      }
    }

    if (schema.prohibited_words.length > 0) {
      const formatForbidden: string[] = [];
      const lowerContent = fullContent.toLowerCase();
      for (const word of schema.prohibited_words) {
        if (lowerContent.includes(word.toLowerCase())) formatForbidden.push(word);
      }
      if (formatForbidden.length > 0) {
        violations.push({
          field: '_format',
          rule: 'prohibited_word',
          message: `Palavras proibidas para ${format}: "${formatForbidden.join('", "')}".`,
          value: formatForbidden.join(', '),
          severity: 'warning',
        });
      }
    }
  }

  const hasErrors = violations.some((v) => v.severity === 'error');
  for (const w of violations.filter((v) => v.severity === 'warning')) {
    warnings.push(w.message);
  }

  return {
    valid: !hasErrors,
    violations,
    parsed_fields: parsed,
    warnings,
  };
}

export function buildRepairPrompt(violations: Violation[], originalContent: string): string {
  const errorViolations = violations.filter((v) => v.severity === 'error');
  if (errorViolations.length === 0) return '';

  let prompt = `## TAREFA: CORREÇÃO DE VIOLAÇÕES\n\n`;
  prompt += `O conteúdo abaixo violou regras críticas. Corrija APENAS os problemas listados.\n`;
  prompt += `NÃO reescreva do zero. Faça correções mínimas e precisas.\n\n`;
  prompt += `### VIOLAÇÕES A CORRIGIR:\n`;
  for (const v of errorViolations) {
    prompt += `- **${v.field}** (${v.rule}): ${v.message}\n`;
    if (v.value) prompt += `  Valor atual: "${v.value.substring(0, 50)}..."\n`;
  }
  prompt += `\n### CONTEÚDO ORIGINAL:\n`;
  prompt += '```\n' + originalContent + '\n```\n';
  prompt += `\n### INSTRUÇÕES:\n`;
  prompt += `1. Corrija APENAS os problemas listados acima\n`;
  prompt += `2. Mantenha todo o resto do conteúdo EXATAMENTE igual\n`;
  prompt += `3. Retorne o conteúdo corrigido no MESMO FORMATO\n`;
  prompt += `4. NÃO adicione explicações ou comentários\n`;
  return prompt;
}

export function needsRepair(result: ValidationResult): boolean {
  return !result.valid;
}

export function getValidationSummary(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return 'Conteúdo validado sem problemas';
  }
  const errors = result.violations.filter((v) => v.severity === 'error').length;
  const warnings = result.warnings.length;
  let summary = '';
  if (errors > 0) summary += `${errors} erro(s) crítico(s)`;
  if (warnings > 0) {
    if (summary) summary += ', ';
    summary += `${warnings} aviso(s)`;
  }
  return summary;
}
