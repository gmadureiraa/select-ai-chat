import { useState, useCallback } from "react";

export type WarningType = 
  | "high_value" 
  | "missing_date" 
  | "duplicate" 
  | "format_mismatch" 
  | "absolute_vs_incremental"
  | "encoding_issue"
  | "missing_column";

export type ErrorType = 
  | "invalid_format" 
  | "no_data" 
  | "critical_missing_column"
  | "parse_error";

export interface CSVWarning {
  type: WarningType;
  message: string;
  row?: number;
  column?: string;
  value?: string | number;
  suggestedFix?: string;
  autoFixable?: boolean;
}

export interface CSVError {
  type: ErrorType;
  message: string;
  row?: number;
  details?: string;
}

export interface CSVSuggestion {
  message: string;
  action?: string;
  autoApply?: boolean;
}

export interface PreviewRow {
  rowNumber: number;
  data: Record<string, string>;
  hasWarning?: boolean;
  warningMessage?: string;
}

export type DetectedCSVType = 
  | "posts" 
  | "reach" 
  | "followers" 
  | "followers_absolute"
  | "views" 
  | "interactions" 
  | "profile_visits" 
  | "link_clicks"
  // YouTube types
  | "youtube_videos"
  | "youtube_daily_views"
  | "youtube_videos_published"
  // Newsletter types
  | "newsletter_daily_performance"
  | "newsletter_posts"
  | "newsletter_subscribers"
  | "newsletter_top_urls"
  | "newsletter_web_performance"
  | "newsletter_link_clicks"
  | "unknown";

export interface ValidationResult {
  isValid: boolean;
  warnings: CSVWarning[];
  errors: CSVError[];
  suggestions: CSVSuggestion[];
  previewData: PreviewRow[];
  detectedType: DetectedCSVType;
  detectedTypeLabel: string;
  confidence: number;
  totalRows: number;
  validRows: number;
  rawData: Record<string, string>[];
  fileName: string;
  needsConversion: boolean;
  conversionType?: "absolute_to_incremental";
}

// Clean text from CSV fields
const cleanText = (text: string): string => {
  return text
    .replace(/\0/g, '')
    .replace(/\r/g, '')
    .trim();
};

// RFC 4180 compliant CSV parser
const parseCSVRFC4180 = (text: string): { headers: string[], data: Record<string, string>[] } => {
  let content = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  
  const firstLine = content.split('\n')[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRow.push(cleanText(currentField));
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(cleanText(currentField));
        currentField = '';
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(cleanText(currentField));
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }
  
  if (rows.length < 2) return { headers: [], data: [] };
  
  // Find header row
  let headerIndex = 0;
  for (let idx = 0; idx < Math.min(5, rows.length); idx++) {
    const rowLower = rows[idx].map(c => c.toLowerCase()).join(' ');
    if (
      rowLower.includes('identificação do post') ||
      rowLower.includes('link permanente') ||
      rowLower.includes('horário de publicação') ||
      (rowLower.includes('data') && rowLower.includes('primary'))
    ) {
      headerIndex = idx;
      break;
    }
  }
  
  const headers = rows[headerIndex].map(h => h.toLowerCase());
  const results: Record<string, string>[] = [];
  
  for (let idx = headerIndex + 1; idx < rows.length; idx++) {
    const row = rows[idx];
    if (row.length < 2) continue;
    
    const record: Record<string, string> = {};
    headers.forEach((header, colIdx) => {
      if (header && row[colIdx] !== undefined) {
        record[header] = row[colIdx];
      }
    });
    results.push(record);
  }
  
  return { headers, data: results };
};

// Enhanced CSV type detection with confidence scoring
const detectCSVTypeEnhanced = (
  text: string, 
  data: Record<string, string>[]
): { type: DetectedCSVType; label: string; confidence: number; needsConversion: boolean; conversionType?: string } => {
  const rawSample = text.split('\n').slice(0, 6).join(' ');
  const normalizedSample = rawSample.replace(/\0/g, '').replace(/\s+/g, ' ').toLowerCase();

  const firstRow = data[0] || {};
  const headers = Object.keys(firstRow).map((h) => h.toLowerCase());
  const headerIncludes = (needle: string) => headers.some((h) => h.includes(needle));

  // Posts CSV
  if (
    headerIncludes('identificação do post') ||
    headerIncludes('identificacao do post') ||
    headerIncludes('post_id') ||
    headerIncludes('link permanente') ||
    normalizedSample.includes('identificação do post') ||
    normalizedSample.includes('link permanente')
  ) {
    return { type: 'posts', label: 'Posts do Instagram', confidence: 95, needsConversion: false };
  }

  // Reach CSV
  if (headerIncludes('alcance') || normalizedSample.includes('alcance')) {
    return { type: 'reach', label: 'Alcance', confidence: 90, needsConversion: false };
  }

  // Followers CSV - analyze if absolute or incremental
  if (
    headerIncludes('seguidores no instagram') ||
    headerIncludes('seguidores') ||
    normalizedSample.includes('seguidores')
  ) {
    // Analyze values to detect if absolute or incremental
    const values = data.map(row => {
      const val = row['primary'] || Object.values(row)[1] || '0';
      return parseInt(val.replace(/[^\d-]/g, ''), 10) || 0;
    }).filter(v => v !== 0);
    
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const variance = max - min;
      
      // If average > 1000 and variance is < 10% of average, likely absolute
      if (avg > 1000 && variance / avg < 0.1) {
        return { 
          type: 'followers_absolute', 
          label: 'Seguidores (Total Absoluto)', 
          confidence: 85, 
          needsConversion: true,
          conversionType: 'absolute_to_incremental'
        };
      }
    }
    
    return { type: 'followers', label: 'Seguidores', confidence: 88, needsConversion: false };
  }

  // Views CSV
  if (headerIncludes('visualizações') || headerIncludes('visualizacoes') || normalizedSample.includes('visualiza')) {
    return { type: 'views', label: 'Visualizações', confidence: 90, needsConversion: false };
  }

  // Interactions CSV
  if (headerIncludes('interações') || headerIncludes('interacoes') || normalizedSample.includes('interaç')) {
    return { type: 'interactions', label: 'Interações', confidence: 90, needsConversion: false };
  }

  // Profile visits CSV
  if (headerIncludes('visitas ao perfil') || normalizedSample.includes('visitas ao perfil')) {
    return { type: 'profile_visits', label: 'Visitas ao Perfil', confidence: 90, needsConversion: false };
  }

  // Link clicks CSV - expanded detection
  if (
    headerIncludes('cliques no link') || 
    headerIncludes('clique no link') ||
    headerIncludes('link clicks') ||
    headerIncludes('cliques externos') ||
    headerIncludes('cliques link') ||
    headerIncludes('cliques bio') ||
    normalizedSample.includes('cliques no link') ||
    normalizedSample.includes('clique no link') ||
    normalizedSample.includes('link clicks')
  ) {
    return { type: 'link_clicks', label: 'Cliques no Link', confidence: 90, needsConversion: false };
  }

  // YouTube: Videos published CSV (Data, Vídeos publicados)
  if (
    headerIncludes('vídeos publicados') ||
    headerIncludes('videos publicados') ||
    headerIncludes('videos published') ||
    normalizedSample.includes('vídeos publicados') ||
    normalizedSample.includes('videos publicados')
  ) {
    return { type: 'youtube_videos_published', label: 'YouTube - Vídeos Publicados', confidence: 95, needsConversion: false };
  }

  // YouTube: Daily views CSV
  if (
    (headerIncludes('data') || headerIncludes('date')) &&
    (headerIncludes('views') || headerIncludes('visualizações')) &&
    !headerIncludes('alcance') && !headerIncludes('seguidores')
  ) {
    return { type: 'youtube_daily_views', label: 'YouTube - Visualizações Diárias', confidence: 85, needsConversion: false };
  }

  // YouTube: Videos list CSV
  if (
    headerIncludes('video id') ||
    headerIncludes('id do vídeo') ||
    headerIncludes('video title') ||
    headerIncludes('título do vídeo') ||
    headerIncludes('watch time') ||
    headerIncludes('tempo de exibição')
  ) {
    return { type: 'youtube_videos', label: 'YouTube - Lista de Vídeos', confidence: 95, needsConversion: false };
  }

  // ===== NEWSLETTER TYPES =====
  
  // Newsletter: Top URLs CSV (position, url, email_clicks)
  if (
    headerIncludes('position') &&
    headerIncludes('url') &&
    (headerIncludes('email_clicks') || headerIncludes('email clicks') || headerIncludes('total_email_clicks'))
  ) {
    return { type: 'newsletter_top_urls', label: 'Newsletter - Top URLs', confidence: 95, needsConversion: false };
  }

  // Newsletter: Link clicks CSV (url, verified columns)
  if (
    headerIncludes('url') &&
    (headerIncludes('verified') || headerIncludes('verified_clicks'))
  ) {
    return { type: 'newsletter_link_clicks', label: 'Newsletter - Cliques em Links', confidence: 90, needsConversion: false };
  }

  // Newsletter: Posts CSV (subject/title and post id)
  if (
    (headerIncludes('subject') || headerIncludes('title') || headerIncludes('título')) &&
    (headerIncludes('post id') || headerIncludes('post_id') || headerIncludes('id'))
  ) {
    return { type: 'newsletter_posts', label: 'Newsletter - Posts', confidence: 90, needsConversion: false };
  }

  // Newsletter: Subscribers acquisition CSV (acquisition source, count)
  if (
    (headerIncludes('acquisition') || headerIncludes('source') || headerIncludes('origem')) &&
    (headerIncludes('count') || headerIncludes('total') || headerIncludes('quantidade'))
  ) {
    return { type: 'newsletter_subscribers', label: 'Newsletter - Assinantes', confidence: 90, needsConversion: false };
  }

  // Newsletter: Web performance CSV (web views, web clicks)
  if (
    headerIncludes('web views') || 
    headerIncludes('web_views') ||
    headerIncludes('web clicks') ||
    headerIncludes('web_clicks')
  ) {
    return { type: 'newsletter_web_performance', label: 'Newsletter - Performance Web', confidence: 90, needsConversion: false };
  }

  // Newsletter: Daily/Email performance CSV (delivered, open rate, click rate)
  if (
    (headerIncludes('delivered') || headerIncludes('entregues')) &&
    (headerIncludes('open rate') || headerIncludes('open_rate') || headerIncludes('taxa de abertura') ||
     headerIncludes('opens') || headerIncludes('aberturas'))
  ) {
    return { type: 'newsletter_daily_performance', label: 'Newsletter - Performance Diária', confidence: 90, needsConversion: false };
  }

  return { type: 'unknown', label: 'Tipo Desconhecido', confidence: 0, needsConversion: false };
};

// Check for total/summary row
const isTotalRow = (row: Record<string, string>, allRows: Record<string, string>[]): boolean => {
  const dateStr = row['data'] || row['date'] || Object.values(row)[0] || '';
  if (!dateStr || dateStr.toLowerCase().includes('total')) return true;
  
  const value = parseInt(row['primary'] || Object.values(row)[1] || '0') || 0;
  
  const otherValues = allRows
    .filter(r => r !== row)
    .map(r => parseInt(r['primary'] || Object.values(r)[1] || '0') || 0)
    .filter(v => v > 0);
  
  if (otherValues.length === 0) return false;
  
  const avg = otherValues.reduce((a, b) => a + b, 0) / otherValues.length;
  const max = Math.max(...otherValues);
  
  if (value > avg * 10 && value > max * 2) {
    return true;
  }
  
  return false;
};

// Validate CSV data comprehensively
export const validateCSV = (text: string, fileName: string): ValidationResult => {
  const warnings: CSVWarning[] = [];
  const errors: CSVError[] = [];
  const suggestions: CSVSuggestion[] = [];
  
  // Parse CSV
  const { headers, data } = parseCSVRFC4180(text);
  
  if (data.length === 0) {
    errors.push({
      type: 'no_data',
      message: 'O arquivo não contém dados válidos',
      details: 'Verifique se o CSV está no formato correto com cabeçalhos e dados.'
    });
    return {
      isValid: false,
      warnings,
      errors,
      suggestions,
      previewData: [],
      detectedType: 'unknown',
      detectedTypeLabel: 'Desconhecido',
      confidence: 0,
      totalRows: 0,
      validRows: 0,
      rawData: [],
      fileName,
      needsConversion: false
    };
  }
  
  // Detect type
  const detection = detectCSVTypeEnhanced(text, data);
  
  // Filter out total rows
  const filteredData = data.filter(row => !isTotalRow(row, data));
  const totalRowsRemoved = data.length - filteredData.length;
  
  if (totalRowsRemoved > 0) {
    warnings.push({
      type: 'high_value',
      message: `${totalRowsRemoved} linha(s) de total/resumo detectada(s) e serão ignoradas`,
      suggestedFix: 'Remover automaticamente',
      autoFixable: true
    });
  }
  
  // Check for duplicate dates
  const dates = new Map<string, number>();
  filteredData.forEach((row, idx) => {
    const date = row['data'] || row['date'] || Object.values(row)[0];
    if (date) {
      const count = dates.get(date) || 0;
      dates.set(date, count + 1);
      if (count > 0) {
        warnings.push({
          type: 'duplicate',
          message: `Data duplicada encontrada: ${date}`,
          row: idx + 2,
          column: 'data',
          suggestedFix: 'Manter apenas o último valor'
        });
      }
    }
  });
  
  // Check for missing dates
  let missingDatesCount = 0;
  filteredData.forEach((row, idx) => {
    const date = row['data'] || row['date'] || Object.values(row)[0];
    if (!date || date.trim() === '') {
      missingDatesCount++;
      if (missingDatesCount <= 3) {
        warnings.push({
          type: 'missing_date',
          message: `Linha ${idx + 2}: Data faltando`,
          row: idx + 2,
          suggestedFix: 'Esta linha será ignorada'
        });
      }
    }
  });
  
  if (missingDatesCount > 3) {
    warnings.push({
      type: 'missing_date',
      message: `E mais ${missingDatesCount - 3} linha(s) sem data`
    });
  }
  
  // Check for conversion needs (absolute followers)
  if (detection.needsConversion) {
    suggestions.push({
      message: 'Os dados parecem ser valores absolutos (totais), não incrementais. Posso calcular os valores diários automaticamente.',
      action: 'convert_to_incremental',
      autoApply: false
    });
    
    warnings.push({
      type: 'absolute_vs_incremental',
      message: 'Valores parecem ser totais acumulados em vez de valores diários',
      suggestedFix: 'Converter para valores incrementais (novos seguidores por dia)',
      autoFixable: true
    });
  }
  
  // Check for suspiciously high values
  filteredData.forEach((row, idx) => {
    const value = parseInt(row['primary'] || Object.values(row)[1] || '0') || 0;
    
    // For non-absolute types, values > 100k are suspicious for daily metrics
    if (!detection.needsConversion && value > 100000 && detection.type !== 'posts') {
      warnings.push({
        type: 'high_value',
        message: `Linha ${idx + 2}: Valor muito alto (${value.toLocaleString()})`,
        row: idx + 2,
        value,
        suggestedFix: 'Verificar se é um valor diário ou total acumulado'
      });
    }
  });
  
  // Create preview data
  const previewData: PreviewRow[] = filteredData.slice(0, 10).map((row, idx) => {
    const rowWarnings = warnings.filter(w => w.row === idx + 2);
    return {
      rowNumber: idx + 1,
      data: row,
      hasWarning: rowWarnings.length > 0,
      warningMessage: rowWarnings.map(w => w.message).join('; ')
    };
  });
  
  // Calculate valid rows
  const validRows = filteredData.filter(row => {
    const date = row['data'] || row['date'] || Object.values(row)[0];
    return date && date.trim() !== '';
  }).length;
  
  // Determine if valid
  const isValid = errors.length === 0 && detection.type !== 'unknown';
  
  // Add suggestions based on detection
  if (detection.type === 'unknown') {
    suggestions.push({
      message: 'Não foi possível identificar o tipo de dados. Verifique se o CSV está no formato esperado do Instagram.',
    });
    errors.push({
      type: 'invalid_format',
      message: 'Formato de CSV não reconhecido',
      details: 'O arquivo não corresponde aos formatos esperados de exportação do Instagram.'
    });
  }
  
  return {
    isValid,
    warnings,
    errors,
    suggestions,
    previewData,
    detectedType: detection.type,
    detectedTypeLabel: detection.label,
    confidence: detection.confidence,
    totalRows: data.length,
    validRows,
    rawData: filteredData,
    fileName,
    needsConversion: detection.needsConversion,
    conversionType: detection.conversionType as "absolute_to_incremental" | undefined
  };
};

// Hook for CSV validation state management
export const useCSVValidation = () => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  
  const validateFiles = useCallback(async (files: File[]): Promise<ValidationResult[]> => {
    setIsValidating(true);
    const results: ValidationResult[] = [];
    
    for (const file of files) {
      try {
        const text = await file.text();
        const result = validateCSV(text, file.name);
        results.push(result);
      } catch (error) {
        results.push({
          isValid: false,
          warnings: [],
          errors: [{
            type: 'parse_error',
            message: `Erro ao ler arquivo: ${file.name}`,
            details: error instanceof Error ? error.message : 'Erro desconhecido'
          }],
          suggestions: [],
          previewData: [],
          detectedType: 'unknown',
          detectedTypeLabel: 'Erro',
          confidence: 0,
          totalRows: 0,
          validRows: 0,
          rawData: [],
          fileName: file.name,
          needsConversion: false
        });
      }
    }
    
    setValidationResults(results);
    setIsValidating(false);
    return results;
  }, []);
  
  const clearValidation = useCallback(() => {
    setValidationResults([]);
  }, []);
  
  const applyFix = useCallback((fileIndex: number, warningIndex: number) => {
    setValidationResults(prev => {
      const updated = [...prev];
      if (updated[fileIndex]) {
        updated[fileIndex].warnings = updated[fileIndex].warnings.filter((_, i) => i !== warningIndex);
      }
      return updated;
    });
  }, []);
  
  return {
    validationResults,
    isValidating,
    validateFiles,
    clearValidation,
    applyFix,
    hasErrors: validationResults.some(r => r.errors.length > 0),
    hasWarnings: validationResults.some(r => r.warnings.length > 0),
    allValid: validationResults.every(r => r.isValid)
  };
};
