// Parser utilities for Meta Ads CSV files from Facebook Ads Manager

import { MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd, MetaAdsParsedCSV } from "@/types/metaAds";

// Parse date range from "Início dos relatórios" and "Término dos relatórios" columns
function parseDateRange(row: Record<string, string>): { start: string | null; end: string | null } {
  const startKey = Object.keys(row).find(k => 
    k.toLowerCase().includes('início') && k.toLowerCase().includes('relatório')
  );
  const endKey = Object.keys(row).find(k => 
    k.toLowerCase().includes('término') && k.toLowerCase().includes('relatório')
  );
  
  const parseDate = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    // Format: "10 de dez. de 2022" or similar
    const months: Record<string, string> = {
      'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
      'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
      'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
    };
    
    const match = dateStr.match(/(\d{1,2})\s*de\s*(\w+)\.?\s*de\s*(\d{4})/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const monthKey = match[2].toLowerCase().substring(0, 3);
      const month = months[monthKey] || '01';
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    return null;
  };
  
  return {
    start: parseDate(row[startKey || '']),
    end: parseDate(row[endKey || ''])
  };
}

// Parse Brazilian currency format: "R$ 1.234,56" -> 1234.56
function parseCurrency(value: string | undefined): number | null {
  if (!value || value === '-' || value === '') return null;
  const cleaned = value
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse number format: "1.234" -> 1234
function parseNumber(value: string | undefined): number | null {
  if (!value || value === '-' || value === '') return null;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
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

// Detect CSV type by headers
export function detectCSVType(headers: string[]): 'campaigns' | 'adsets' | 'ads' | null {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // Check for campaign-specific headers
  if (lowerHeaders.some(h => h.includes('nome da campanha') || h.includes('campaign name'))) {
    // Check if it's actually ads (has quality ranking)
    if (lowerHeaders.some(h => h.includes('classificação de qualidade') || h.includes('quality ranking'))) {
      return 'ads';
    }
    // Check if it's adsets (has "conjunto" in name column)
    if (lowerHeaders.some(h => h.includes('nome do conjunto') || h.includes('ad set name'))) {
      return 'adsets';
    }
    return 'campaigns';
  }
  
  if (lowerHeaders.some(h => h.includes('nome do conjunto') || h.includes('ad set name'))) {
    return 'adsets';
  }
  
  if (lowerHeaders.some(h => h.includes('nome do anúncio') || h.includes('ad name'))) {
    return 'ads';
  }
  
  return null;
}

// Parse CSV content to array of objects
export function parseCSVContent(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(v => v && v !== ''));
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
