// Parser utilities for Meta Ads CSV files from Facebook Ads Manager

import { MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd, MetaAdsParsedCSV } from "@/types/metaAds";

// Parse date with multiple format support
function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr === '-' || dateStr === '') return null;
  
  const cleaned = dateStr.trim();
  
  // Format 1: ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Format 2: Brazilian extensive format "10 de dez. de 2022"
  const months: Record<string, string> = {
    'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
    'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
    'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
  };
  
  const extensoMatch = cleaned.match(/(\d{1,2})\s*de\s*(\w+)\.?\s*de\s*(\d{4})/i);
  if (extensoMatch) {
    const day = extensoMatch[1].padStart(2, '0');
    const monthKey = extensoMatch[2].toLowerCase().substring(0, 3);
    const month = months[monthKey] || '01';
    const year = extensoMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Format 3: DD/MM/YYYY
  const brMatch = cleaned.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  
  // Format 4: MM/DD/YYYY (US format)
  const usMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    return `${usMatch[3]}-${month}-${day}`;
  }
  
  return null;
}

// Parse date range from "Início dos relatórios" and "Término dos relatórios" columns
function parseDateRange(row: Record<string, string>): { start: string | null; end: string | null } {
  const startKey = Object.keys(row).find(k => 
    k.toLowerCase().includes('início') && k.toLowerCase().includes('relatório')
  );
  const endKey = Object.keys(row).find(k => 
    k.toLowerCase().includes('término') && k.toLowerCase().includes('relatório')
  );
  
  return {
    start: parseDate(row[startKey || '']),
    end: parseDate(row[endKey || ''])
  };
}

// Parse Brazilian currency format: "R$ 1.234,56" -> 1234.56 OR simple number "1478.38"
function parseCurrency(value: string | undefined): number | null {
  if (!value || value === '-' || value === '') return null;
  
  const trimmed = value.trim();
  
  // If it's a simple decimal number (e.g., 1478.38)
  if (/^[\d.]+$/.test(trimmed) && (trimmed.split('.').length <= 2)) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
  }
  
  // If it's a simple decimal number with comma (e.g., 1478,38) - no thousand separator
  if (/^\d+,\d{2}$/.test(trimmed)) {
    const num = parseFloat(trimmed.replace(',', '.'));
    return isNaN(num) ? null : num;
  }
  
  // Brazilian format with R$ (e.g., R$ 1.234,56)
  const cleaned = trimmed
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse number format: "1.234" -> 1234 OR simple "1234"
function parseNumber(value: string | undefined): number | null {
  if (!value || value === '-' || value === '') return null;
  
  const trimmed = value.trim();
  
  // If it's a simple integer (e.g., 1234)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  
  // If it's a decimal number (e.g., 1234.56)
  if (/^\d+\.\d+$/.test(trimmed)) {
    return Math.round(parseFloat(trimmed));
  }
  
  // Brazilian format (e.g., 1.234 or 1.234,56)
  const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

// Get value by finding key that includes the search term
function getValueByKey(row: Record<string, string>, searchTerms: string[]): string | undefined {
  const key = Object.keys(row).find(k => {
    const lower = k.toLowerCase();
    return searchTerms.some(term => lower.includes(term.toLowerCase()));
  });
  return key ? row[key] : undefined;
}

// Rename duplicate headers: "Col", "Col" -> "Col", "Col_2"
function deduplicateHeaders(headers: string[]): string[] {
  const counts: Record<string, number> = {};
  return headers.map(h => {
    const clean = h.trim().replace(/^["']|["']$/g, '');
    counts[clean] = (counts[clean] || 0) + 1;
    return counts[clean] > 1 ? `${clean}_${counts[clean]}` : clean;
  });
}

// Parse a single CSV line respecting quotes
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Handle escaped quotes (double quotes)
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^["']|["']$/g, ''));
  
  return values;
}

// Detect CSV type by headers - improved detection
export function detectCSVType(headers: string[]): 'campaigns' | 'adsets' | 'ads' | null {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  const hasAd = lowerHeaders.some(h => 
    h.includes('nome do anúncio') || h.includes('ad name')
  );
  const hasAdset = lowerHeaders.some(h => 
    h.includes('nome do conjunto') || h.includes('ad set name')
  );
  const hasCampaign = lowerHeaders.some(h => 
    h.includes('nome da campanha') || h.includes('campaign name')
  );
  
  // Priority: if has ad name, it's ads (most granular)
  if (hasAd) return 'ads';
  // If has adset but no ad, it's adsets
  if (hasAdset) return 'adsets';
  // If only has campaign, it's campaigns
  if (hasCampaign) return 'campaigns';
  
  return null;
}

// Parse CSV content to array of objects with improved handling
export function parseCSVContent(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Detect delimiter - check first line
  const firstLine = lines[0];
  let delimiter = ',';
  
  // Count occurrences outside quotes
  let semicolonCount = 0;
  let commaCount = 0;
  let inQuotes = false;
  
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (char === ';') semicolonCount++;
      if (char === ',') commaCount++;
    }
  }
  
  delimiter = semicolonCount > commaCount ? ';' : ',';
  
  // Parse headers with deduplication
  const rawHeaders = parseCSVLine(lines[0], delimiter);
  const headers = deduplicateHeaders(rawHeaders);
  
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(v => v && v !== ''));
}

// Validation result interface
export interface CSVValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// Validate parsed data before import
export function validateParsedData(parsed: MetaAdsParsedCSV): CSVValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  if (parsed.data.length === 0) {
    errors.push('Nenhum registro encontrado no arquivo');
  }
  
  // Check for records without names
  const emptyNames = parsed.data.filter(d => {
    const data = d as any;
    return !data.campaign_name && !data.adset_name && !data.ad_name;
  }).length;
  
  if (emptyNames > 0) {
    warnings.push(`${emptyNames} registro(s) sem nome identificável`);
  }
  
  // Check for records without dates
  const missingDates = parsed.data.filter(d => {
    const data = d as any;
    return !data.start_date && !data.end_date;
  }).length;
  
  if (missingDates > 0) {
    warnings.push(`${missingDates} registro(s) sem datas de período`);
  }
  
  // Check for records without spend
  const missingSpend = parsed.data.filter(d => {
    const data = d as any;
    return data.amount_spent === null || data.amount_spent === undefined;
  }).length;
  
  if (missingSpend > 0 && missingSpend < parsed.data.length) {
    warnings.push(`${missingSpend} registro(s) sem valor gasto`);
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

// Parse campaigns CSV
export function parseCampaignsCSV(content: string): MetaAdsParsedCSV {
  const rows = parseCSVContent(content);
  
  const data: Partial<MetaAdsCampaign>[] = rows.map(row => {
    const dateRange = parseDateRange(row);
    
    return {
      campaign_name: getValueByKey(row, ['nome da campanha', 'campaign name']) || '',
      campaign_status: getValueByKey(row, ['veiculação', 'delivery', 'status'])?.toLowerCase() || null,
      budget: parseCurrency(getValueByKey(row, ['orçamento', 'budget'])),
      budget_type: getValueByKey(row, ['tipo de orçamento', 'budget type'])?.toLowerCase() || null,
      attribution_setting: getValueByKey(row, ['atribuição', 'attribution']) || null,
      results: parseNumber(getValueByKey(row, ['resultados', 'results'])),
      result_type: getValueByKey(row, ['indicador de resultado', 'result indicator', 'result type'])?.toLowerCase() || null,
      reach: parseNumber(getValueByKey(row, ['alcance', 'reach'])),
      impressions: parseNumber(getValueByKey(row, ['impressões', 'impressions'])),
      cost_per_result: parseCurrency(getValueByKey(row, ['custo por resultado', 'cost per result'])),
      amount_spent: parseCurrency(getValueByKey(row, ['valor usado', 'amount spent', 'gasto'])),
      start_date: dateRange.start,
      end_date: dateRange.end,
      metadata: { raw: row }
    };
  }).filter(c => c.campaign_name);
  
  // Get overall date range
  const dates = data.filter(d => d.start_date).map(d => d.start_date!);
  const endDates = data.filter(d => d.end_date).map(d => d.end_date!);
  
  return {
    type: 'campaigns',
    data,
    dateRange: dates.length > 0 ? {
      start: dates.sort()[0],
      end: endDates.sort().reverse()[0] || dates.sort().reverse()[0]
    } : undefined
  };
}

// Parse ad sets CSV
export function parseAdSetsCSV(content: string): MetaAdsParsedCSV {
  const rows = parseCSVContent(content);
  
  const data: Partial<MetaAdsAdSet>[] = rows.map(row => {
    const dateRange = parseDateRange(row);
    
    return {
      adset_name: getValueByKey(row, ['nome do conjunto', 'ad set name']) || '',
      adset_status: getValueByKey(row, ['veiculação', 'delivery', 'status'])?.toLowerCase() || null,
      bid: parseCurrency(getValueByKey(row, ['lance', 'bid'])),
      bid_type: getValueByKey(row, ['tipo de lance', 'bid type'])?.toLowerCase() || null,
      budget: parseCurrency(getValueByKey(row, ['orçamento', 'budget'])),
      budget_type: getValueByKey(row, ['tipo de orçamento', 'budget type'])?.toLowerCase() || null,
      attribution_setting: getValueByKey(row, ['atribuição', 'attribution']) || null,
      results: parseNumber(getValueByKey(row, ['resultados', 'results'])),
      result_type: getValueByKey(row, ['indicador de resultado', 'result indicator'])?.toLowerCase() || null,
      reach: parseNumber(getValueByKey(row, ['alcance', 'reach'])),
      impressions: parseNumber(getValueByKey(row, ['impressões', 'impressions'])),
      cost_per_result: parseCurrency(getValueByKey(row, ['custo por resultado', 'cost per result'])),
      amount_spent: parseCurrency(getValueByKey(row, ['valor usado', 'amount spent', 'gasto'])),
      start_date: dateRange.start,
      end_date: dateRange.end,
      metadata: { raw: row }
    };
  }).filter(a => a.adset_name);
  
  const dates = data.filter(d => d.start_date).map(d => d.start_date!);
  const endDates = data.filter(d => d.end_date).map(d => d.end_date!);
  
  return {
    type: 'adsets',
    data,
    dateRange: dates.length > 0 ? {
      start: dates.sort()[0],
      end: endDates.sort().reverse()[0] || dates.sort().reverse()[0]
    } : undefined
  };
}

// Parse ads CSV
export function parseAdsCSV(content: string): MetaAdsParsedCSV {
  const rows = parseCSVContent(content);
  
  const data: Partial<MetaAdsAd>[] = rows.map(row => {
    const dateRange = parseDateRange(row);
    
    return {
      ad_name: getValueByKey(row, ['nome do anúncio', 'ad name']) || '',
      adset_name: getValueByKey(row, ['nome do conjunto', 'ad set name']) || null,
      ad_status: getValueByKey(row, ['veiculação', 'delivery', 'status'])?.toLowerCase() || null,
      results: parseNumber(getValueByKey(row, ['resultados', 'results'])),
      result_type: getValueByKey(row, ['indicador de resultado', 'result indicator'])?.toLowerCase() || null,
      reach: parseNumber(getValueByKey(row, ['alcance', 'reach'])),
      impressions: parseNumber(getValueByKey(row, ['impressões', 'impressions'])),
      cost_per_result: parseCurrency(getValueByKey(row, ['custo por resultado', 'cost per result'])),
      quality_ranking: getValueByKey(row, ['classificação de qualidade', 'quality ranking']) || null,
      engagement_rate_ranking: getValueByKey(row, ['classificação da taxa de engajamento', 'engagement rate ranking']) || null,
      conversion_rate_ranking: getValueByKey(row, ['classificação da taxa de conversão', 'conversion rate ranking']) || null,
      amount_spent: parseCurrency(getValueByKey(row, ['valor usado', 'amount spent', 'gasto'])),
      start_date: dateRange.start,
      end_date: dateRange.end,
      metadata: { raw: row }
    };
  }).filter(a => a.ad_name);
  
  const dates = data.filter(d => d.start_date).map(d => d.start_date!);
  const endDates = data.filter(d => d.end_date).map(d => d.end_date!);
  
  return {
    type: 'ads',
    data,
    dateRange: dates.length > 0 ? {
      start: dates.sort()[0],
      end: endDates.sort().reverse()[0] || dates.sort().reverse()[0]
    } : undefined
  };
}

// Auto-detect and parse CSV
export function parseMetaAdsCSV(content: string): MetaAdsParsedCSV | null {
  const rows = parseCSVContent(content);
  if (rows.length === 0) return null;
  
  const headers = Object.keys(rows[0]);
  const type = detectCSVType(headers);
  
  switch (type) {
    case 'campaigns':
      return parseCampaignsCSV(content);
    case 'adsets':
      return parseAdSetsCSV(content);
    case 'ads':
      return parseAdsCSV(content);
    default:
      return null;
  }
}
