// =====================================================
// CONTENT VALIDATOR - Parser + Validation + Repair
// Version 1.0 - Part of "Impeccable Content" architecture
// =====================================================

import { FormatSchema, getFormatSchema } from "./format-schemas.ts";
import { 
  GLOBAL_FORBIDDEN_PHRASES, 
  checkForbiddenPhrases, 
  checkMetaText, 
  checkHashtags 
} from "./quality-rules.ts";

// =====================================================
// TYPES
// =====================================================

export interface Violation {
  field: string;
  rule: "max_length" | "min_length" | "required" | "prohibited_word" | "hashtag" | "meta_text" | "forbidden_phrase";
  message: string;
  value?: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  parsed_fields: Record<string, string>;
  warnings: string[];
}

// =====================================================
// PARSER - Extract fields from content based on format
// =====================================================

/**
 * Parse content output into structured fields based on format
 * Supports both markdown-style headers and labeled sections
 */
export function parseOutput(content: string, format: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const schema = getFormatSchema(format);
  
  if (!schema) {
    // If no schema, return the whole content as 'content' field
    parsed.content = content.trim();
    return parsed;
  }
  
  // Strategy 1: Look for **FIELD:** patterns
  const boldFieldPattern = /\*\*([^*]+)\*\*:\s*([^*\n]+(?:\n(?!\*\*)[^\n]*)*)/gi;
  let match;
  
  while ((match = boldFieldPattern.exec(content)) !== null) {
    const fieldLabel = match[1].toLowerCase().trim();
    const fieldValue = match[2].trim();
    
    // Map common labels to field names
    const fieldMap: Record<string, string> = {
      'assunto': 'subject',
      'preview': 'preview',
      'texto principal': 'visual_text',
      'texto do visual': 'visual_text',
      'texto secundário': 'visual_secondary',
      'legenda': 'caption',
      'cta': 'cta',
      'gancho': 'hook',
      'título': 'title',
      'meta description': 'meta_description',
      'thumbnail text': 'thumbnail_text',
      'tweet de divulgação': 'promo_tweet',
      'botão cta': 'cta',
    };
    
    const normalizedField = fieldMap[fieldLabel] || fieldLabel.replace(/\s+/g, '_');
    parsed[normalizedField] = fieldValue;
  }
  
  // Strategy 2: Look for sections divided by ---
  const sections = content.split(/^---$/m).map(s => s.trim()).filter(Boolean);
  
  if (sections.length > 1) {
    // Multi-section content (carousel, newsletter, etc.)
    // Try to extract body from middle sections
    if (!parsed.body && sections.length >= 2) {
      // Everything between first and last section is body
      const bodyParts = sections.slice(1, -1);
      if (bodyParts.length > 0) {
        parsed.body = bodyParts.join('\n\n').trim();
      }
    }
    
    // Last section often contains caption or CTA
    const lastSection = sections[sections.length - 1];
    if (lastSection.toLowerCase().includes('legenda:')) {
      const captionMatch = lastSection.match(/legenda:\s*([\s\S]+)/i);
      if (captionMatch && !parsed.caption) {
        parsed.caption = captionMatch[1].trim();
      }
    }
  }
  
  // Strategy 3: Look for Página X: patterns (carousel)
  const slidePattern = /^Página\s*(\d+):\s*\n([\s\S]*?)(?=^Página|\n---|\n\*\*LEGENDA|$)/gim;
  const slides: string[] = [];
  
  while ((match = slidePattern.exec(content)) !== null) {
    slides.push(match[2].trim());
  }
  
  if (slides.length > 0) {
    // First slide is cover
    parsed.cover_headline = slides[0].split('\n')[0].trim();
    if (slides[0].split('\n').length > 1) {
      parsed.cover_subtitle = slides[0].split('\n').slice(1).join('\n').trim();
    }
    
    // Last slide is CTA
    if (slides.length > 1) {
      parsed.cta_slide = slides[slides.length - 1];
      parsed.slides = JSON.stringify(slides.slice(1, -1));
    }
  }
  
  // Strategy 4: Look for Tweet X/Y: patterns (thread)
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
  
  // Strategy 5: Look for Story X: patterns
  const storyPattern = /^Story\s*(\d+):\s*\n([\s\S]*?)(?=^Story\s*\d|^---|\n\*\*|$)/gim;
  const stories: string[] = [];
  
  while ((match = storyPattern.exec(content)) !== null) {
    stories.push(match[2].trim());
  }
  
  if (stories.length > 0) {
    parsed.stories_content = JSON.stringify(stories);
    parsed.cta_story = stories[stories.length - 1];
  }
  
  // Strategy 6: Look for section headers ## 
  const sectionPattern = /^##\s*(.+)\n([\s\S]*?)(?=^##|\n---|\n\*\*[A-Z]|$)/gim;
  const sectionContent: string[] = [];
  
  while ((match = sectionPattern.exec(content)) !== null) {
    sectionContent.push(match[2].trim());
  }
  
  if (sectionContent.length > 0 && !parsed.body) {
    parsed.body = sectionContent.join('\n\n');
  }
  
  // Fallback: If we couldn't parse specific fields, use content as-is
  if (Object.keys(parsed).length === 0) {
    parsed.content = content.trim();
  }
  
  return parsed;
}

// =====================================================
// VALIDATOR - Check content against schema and rules
// =====================================================

/**
 * Validate parsed content against format schema and quality rules
 */
export function validateContent(
  parsed: Record<string, string>, 
  format: string,
  clientAvoidWords?: string[]
): ValidationResult {
  const violations: Violation[] = [];
  const warnings: string[] = [];
  const schema = getFormatSchema(format);
  
  // Get full content for global checks
  const fullContent = Object.values(parsed).join('\n');
  
  // ===== GLOBAL CHECKS =====
  
  // Check for meta-text at start
  if (checkMetaText(fullContent)) {
    violations.push({
      field: "_global",
      rule: "meta_text",
      message: "Conteúdo começa com meta-texto ('Aqui está...', 'Segue...'). Remova e comece diretamente com o conteúdo.",
      severity: "error"
    });
  }
  
  // Check for hashtags
  const hashtags = checkHashtags(fullContent);
  if (hashtags.length > 0) {
    violations.push({
      field: "_global",
      rule: "hashtag",
      message: `Hashtags encontradas: ${hashtags.slice(0, 5).join(', ')}. Remova todas as hashtags.`,
      value: hashtags.join(', '),
      severity: "error"
    });
  }
  
  // Check for forbidden AI phrases
  const forbiddenFound = checkForbiddenPhrases(fullContent);
  if (forbiddenFound.length > 0) {
    violations.push({
      field: "_global",
      rule: "forbidden_phrase",
      message: `Frases genéricas de IA encontradas: "${forbiddenFound.slice(0, 3).join('", "')}". Reescreva de forma mais natural.`,
      value: forbiddenFound.join(', '),
      severity: "error"
    });
  }
  
  // Check client-specific avoid words
  if (clientAvoidWords && clientAvoidWords.length > 0) {
    const clientForbidden: string[] = [];
    const lowerContent = fullContent.toLowerCase();
    
    for (const word of clientAvoidWords) {
      if (lowerContent.includes(word.toLowerCase())) {
        clientForbidden.push(word);
      }
    }
    
    if (clientForbidden.length > 0) {
      violations.push({
        field: "_client_voice",
        rule: "prohibited_word",
        message: `Palavras na lista "Evite" do cliente: "${clientForbidden.join('", "')}". Use alternativas.`,
        value: clientForbidden.join(', '),
        severity: "warning"
      });
    }
  }
  
  // ===== SCHEMA CHECKS =====
  
  if (schema) {
    // Check required fields
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      if (fieldSchema.required && !parsed[fieldName]) {
        violations.push({
          field: fieldName,
          rule: "required",
          message: `Campo obrigatório "${fieldName}" não encontrado. ${fieldSchema.description}`,
          severity: "error"
        });
      }
      
      // Check length limits if field exists
      if (parsed[fieldName]) {
        const value = parsed[fieldName];
        const charCount = value.length;
        
        if (fieldSchema.max_length && charCount > fieldSchema.max_length) {
          violations.push({
            field: fieldName,
            rule: "max_length",
            message: `Campo "${fieldName}" excede limite: ${charCount}/${fieldSchema.max_length} caracteres.`,
            value: value.substring(0, 100) + '...',
            severity: "error"
          });
        }
        
        if (fieldSchema.min_length && charCount < fieldSchema.min_length) {
          violations.push({
            field: fieldName,
            rule: "min_length",
            message: `Campo "${fieldName}" muito curto: ${charCount}/${fieldSchema.min_length} caracteres mínimos.`,
            value: value.substring(0, 100),
            severity: "warning"
          });
        }
      }
    }
    
    // Check format-specific prohibited words
    if (schema.prohibited_words.length > 0) {
      const formatForbidden: string[] = [];
      const lowerContent = fullContent.toLowerCase();
      
      for (const word of schema.prohibited_words) {
        if (lowerContent.includes(word.toLowerCase())) {
          formatForbidden.push(word);
        }
      }
      
      if (formatForbidden.length > 0) {
        violations.push({
          field: "_format",
          rule: "prohibited_word",
          message: `Palavras proibidas para ${format}: "${formatForbidden.join('", "')}".`,
          value: formatForbidden.join(', '),
          severity: "warning"
        });
      }
    }
  }
  
  // ===== DETERMINE VALIDITY =====
  
  // Content is invalid if there are any error-level violations
  const hasErrors = violations.some(v => v.severity === "error");
  
  // Collect warnings
  const warningViolations = violations.filter(v => v.severity === "warning");
  for (const w of warningViolations) {
    warnings.push(w.message);
  }
  
  return {
    valid: !hasErrors,
    violations,
    parsed_fields: parsed,
    warnings
  };
}

// =====================================================
// REPAIR PROMPT BUILDER
// =====================================================

/**
 * Build a repair prompt for the AI to fix specific violations
 */
export function buildRepairPrompt(violations: Violation[], originalContent: string): string {
  const errorViolations = violations.filter(v => v.severity === "error");
  
  if (errorViolations.length === 0) {
    return ''; // Nothing to repair
  }
  
  let prompt = `## TAREFA: CORREÇÃO DE VIOLAÇÕES\n\n`;
  prompt += `O conteúdo abaixo violou regras críticas. Corrija APENAS os problemas listados.\n`;
  prompt += `NÃO reescreva do zero. Faça correções mínimas e precisas.\n\n`;
  
  prompt += `### VIOLAÇÕES A CORRIGIR:\n`;
  for (const v of errorViolations) {
    prompt += `- **${v.field}** (${v.rule}): ${v.message}\n`;
    if (v.value) {
      prompt += `  Valor atual: "${v.value.substring(0, 50)}..."\n`;
    }
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

/**
 * Quick check if content needs repair (has error-level violations)
 */
export function needsRepair(result: ValidationResult): boolean {
  return !result.valid;
}

/**
 * Get a summary of validation issues for logging
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return "✅ Conteúdo validado sem problemas";
  }
  
  const errors = result.violations.filter(v => v.severity === "error").length;
  const warnings = result.warnings.length;
  
  let summary = "";
  if (errors > 0) {
    summary += `❌ ${errors} erro(s) crítico(s)`;
  }
  if (warnings > 0) {
    if (summary) summary += ", ";
    summary += `⚠️ ${warnings} aviso(s)`;
  }
  
  return summary;
}
