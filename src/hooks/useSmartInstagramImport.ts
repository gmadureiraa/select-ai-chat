import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type CSVType = 
  | "posts" 
  | "stories"
  | "reach" 
  | "followers" 
  | "views" 
  | "interactions" 
  | "profile_visits" 
  | "link_clicks"
  | "unknown";

interface DetectedCSV {
  type: CSVType;
  label: string;
  data: Record<string, string>[];
}

// Clean text from CSV fields
const cleanText = (text: string): string => {
  return text
    .replace(/\0/g, '')
    .replace(/\r/g, '')
    .trim();
};

// RFC 4180 compliant CSV parser - handles multi-line fields properly
const parseCSVRFC4180 = (text: string): Record<string, string>[] => {
  // Normalize line endings and remove BOM
  let content = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  
  // Detect delimiter from first line
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
          // Escaped quote ""
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // Regular character inside quotes (including newlines)
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        // End of field
        currentRow.push(cleanText(currentField));
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        // End of row
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
  
  // Don't forget last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(cleanText(currentField));
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }
  
  if (rows.length < 2) return [];
  
  // Find header row - skip metadata lines
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
  
  return results;
};

// Detect CSV type based on content and headers - ENHANCED VERSION
const detectCSVType = (text: string, data: Record<string, string>[]): DetectedCSV => {
  const rawSample = text.split('\n').slice(0, 6).join(' ');
  const normalizedSample = rawSample
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const firstRow = data[0] || {};
  const headers = Object.keys(firstRow).map((h) => h.toLowerCase());
  const headerIncludes = (needle: string) => headers.some((h) => h.includes(needle));

  // PRIORITY: Check VALUES in first data row to detect Stories
  // This catches cases where "tipo de post" = "Story do Instagram"
  const postTypeValue = (firstRow['tipo de post'] || firstRow['Tipo de post'] || '').toLowerCase();
  console.log('[CSV Detection] Headers:', headers);
  console.log('[CSV Detection] Post type value:', postTypeValue);

  if (postTypeValue.includes('story') || postTypeValue.includes('stories')) {
    console.log('[CSV Detection] Detected Stories by VALUE');
    return { type: 'stories', label: 'Stories do Instagram', data };
  }

  // Stories CSV - detect by headers (no tipo de post column)
  if (
    headerIncludes('navegação') ||
    headerIncludes('toques em figurinhas') ||
    headerIncludes('toques para avançar') ||
    headerIncludes('toques para voltar') ||
    headerIncludes('saídas') ||
    normalizedSample.includes('toques em figurinhas') ||
    normalizedSample.includes('navegação') ||
    // If has "duração" AND "visualizações" but NOT "tipo de post", likely stories
    (headerIncludes('duração') && headerIncludes('visualizações') && !headerIncludes('tipo de post'))
  ) {
    return { type: 'stories', label: 'Stories do Instagram', data };
  }

  // Posts CSV - has post identification columns
  if (
    headerIncludes('identificação do post') ||
    headerIncludes('identificacao do post') ||
    headerIncludes('post_id') ||
    headerIncludes('link permanente') ||
    headerIncludes('tipo de post') ||
    normalizedSample.includes('identificação do post') ||
    normalizedSample.includes('link permanente')
  ) {
    return { type: 'posts', label: 'Posts do Instagram', data };
  }

  // Reach CSV
  if (headerIncludes('alcance') || normalizedSample.includes('alcance')) {
    return { type: 'reach', label: 'Alcance', data };
  }

  // Followers CSV
  if (
    headerIncludes('seguidores no instagram') ||
    headerIncludes('seguidores') ||
    normalizedSample.includes('seguidores')
  ) {
    return { type: 'followers', label: 'Seguidores', data };
  }

  // Views CSV
  if (headerIncludes('visualizações') || headerIncludes('visualizacoes') || normalizedSample.includes('visualiza')) {
    return { type: 'views', label: 'Visualizações', data };
  }

  // Interactions CSV
  if (headerIncludes('interações') || headerIncludes('interacoes') || normalizedSample.includes('interaç')) {
    return { type: 'interactions', label: 'Interações', data };
  }

  // Profile visits CSV
  if (headerIncludes('visitas ao perfil') || normalizedSample.includes('visitas ao perfil')) {
    return { type: 'profile_visits', label: 'Visitas ao Perfil', data };
  }

  // Link clicks CSV - ENHANCED DETECTION with many more variations
  if (
    headerIncludes('cliques no link') || 
    headerIncludes('clique no link') ||
    headerIncludes('link clicks') ||
    headerIncludes('clicks') ||
    headerIncludes('cliques externos') ||
    headerIncludes('cliques link') ||
    headerIncludes('cliques bio') ||
    headerIncludes('link bio') ||
    headerIncludes('cliques na bio') ||
    headerIncludes('toques no link') ||
    headerIncludes('taps on link') ||
    normalizedSample.includes('cliques no link') ||
    normalizedSample.includes('clique no link') ||
    normalizedSample.includes('link clicks') ||
    normalizedSample.includes('cliques externos') ||
    normalizedSample.includes('toques no link')
  ) {
    return { type: 'link_clicks', label: 'Cliques no Link', data };
  }

  return { type: 'unknown', label: 'Desconhecido', data };
};

interface InstagramPostRecord {
  client_id: string;
  post_id: string;
  post_type: string;
  caption: string | null;
  posted_at: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  permalink: string;
  metadata: {
    account_name: string | null;
    username: string | null;
    follows_from_post: number;
    duration_seconds: number;
  };
}

// Process posts CSV - handles the detailed Instagram export format
const processPostsCSV = (data: Record<string, string>[], clientId: string): InstagramPostRecord[] => {
  const validPosts: InstagramPostRecord[] = [];
  let invalidCount = 0;
  
  for (const row of data) {
    // Only process "Total" rows from Instagram exports, or rows without this field
    const commentData = row['comentário de dados']?.toLowerCase();
    if (commentData && commentData !== 'total') continue;
    
    // Parse date from various formats
    let postedAt: string | null = null;
    const dateStr = row['horário de publicação'] || row['data'] || row['posted_at'];
    if (dateStr) {
      // Format 1: "12/10/2025 06:54" (MM/DD/YYYY HH:mm)
      let parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (parts) {
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        const hour = parts[4].padStart(2, '0');
        postedAt = `${parts[3]}-${month}-${day}T${hour}:${parts[5]}:00`;
      } else {
        // Format 2: ISO
        if (dateStr.includes('T') || dateStr.includes('-')) {
          postedAt = dateStr;
        } else {
          // Format 3: "15/01/2025" (DD/MM/YYYY)
          parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (parts) {
            const day = parts[1].padStart(2, '0');
            const month = parts[2].padStart(2, '0');
            postedAt = `${parts[3]}-${month}-${day}T00:00:00`;
          }
        }
      }
    }

    // Get permalink
    const permalink = row['link permanente'] || row['permalink'] || null;
    
    // Skip invalid records
    if (!postedAt || !permalink) {
      invalidCount++;
      continue;
    }

    // Map post type from Portuguese
    let postType = 'image';
    const typeStr = (row['tipo de post'] || row['post_type'] || '').toLowerCase();
    if (typeStr.includes('carrossel') || typeStr.includes('carousel')) postType = 'carousel';
    else if (typeStr.includes('reel')) postType = 'reel';
    else if (typeStr.includes('story') || typeStr.includes('stories')) postType = 'story';
    else if (typeStr.includes('imagem') || typeStr.includes('image')) postType = 'image';

    // Parse numeric fields
    const parseNum = (val: string | undefined): number => {
      if (!val) return 0;
      const num = parseInt(val.replace(/[^\d-]/g, ''), 10);
      return isNaN(num) ? 0 : num;
    };

    const likes = parseNum(row['curtidas'] || row['likes']);
    const comments = parseNum(row['comentários'] || row['comments']);
    const shares = parseNum(row['compartilhamentos'] || row['shares']);
    const saves = parseNum(row['salvamentos'] || row['saves']);
    const reach = parseNum(row['alcance'] || row['reach']);
    const impressions = parseNum(row['visualizações'] || row['impressions'] || row['views']);
    
    // Parse engagement rate from CSV or calculate if missing
    let engagementRate = parseFloat(row['taxa de engajamento'] || row['engagement_rate'] || '0') || 0;
    
    // If engagement_rate is 0 but we have reach/impressions, calculate it
    if (engagementRate === 0 && (reach > 0 || impressions > 0)) {
      const totalInteractions = likes + comments + saves + shares;
      const reachOrImpressions = reach > 0 ? reach : impressions;
      engagementRate = (totalInteractions / reachOrImpressions) * 100;
    }

    validPosts.push({
      client_id: clientId,
      post_id: row['identificação do post'] || row['post_id'] || `post_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      post_type: postType,
      caption: row['descrição'] || row['caption'] || row['legenda'] || null,
      posted_at: postedAt,
      likes,
      comments,
      shares,
      saves,
      reach,
      impressions,
      engagement_rate: Math.round(engagementRate * 100) / 100,
      permalink: permalink,
      metadata: {
        account_name: row['nome da conta'] || null,
        username: row['nome de usuário da conta'] || null,
        follows_from_post: parseNum(row['seguimentos'] || row['follows']),
        duration_seconds: parseNum(row['duração (s)'] || row['duration']),
      }
    });
  }
  
  console.log(`Posts CSV: ${validPosts.length} valid, ${invalidCount} invalid (missing date/permalink)`);
  return validPosts;
};

// Process Stories CSV
const processStoriesCSV = (data: Record<string, string>[], clientId: string) => {
  const validStories: any[] = [];
  let invalidCount = 0;
  
  for (const row of data) {
    // Only process "Total" rows from Instagram exports, or rows without this field
    const commentData = row['comentário de dados']?.toLowerCase();
    if (commentData && commentData !== 'total') continue;
    
    // Parse date
    let postedAt: string | null = null;
    const dateStr = row['horário de publicação'] || row['data'] || row['posted_at'];
    if (dateStr) {
      const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (parts) {
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        const hour = parts[4].padStart(2, '0');
        postedAt = `${parts[3]}-${month}-${day}T${hour}:${parts[5]}:00`;
      } else if (dateStr.includes('T') || dateStr.includes('-')) {
        postedAt = dateStr;
      }
    }
    
    // Get story_id
    const storyId = row['identificação do post'] || row['story_id'] || row['post_id'] || `story_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Skip if no date
    if (!postedAt) {
      invalidCount++;
      continue;
    }
    
    const parseNum = (val: string | undefined): number => {
      if (!val) return 0;
      const num = parseInt(val.replace(/[^\d-]/g, ''), 10);
      return isNaN(num) ? 0 : num;
    };
    
    const duration = parseNum(row['duração (s)'] || row['duration']);
    
    validStories.push({
      client_id: clientId,
      story_id: storyId,
      media_type: duration > 0 ? 'video' : 'image',
      views: parseNum(row['visualizações'] || row['views']),
      reach: parseNum(row['alcance'] || row['reach']),
      likes: parseNum(row['curtidas'] || row['likes']),
      shares: parseNum(row['compartilhamentos'] || row['shares']),
      replies: parseNum(row['respostas'] || row['replies']),
      forward_taps: parseNum(row['toques para avançar'] || row['forward_taps']),
      back_taps: parseNum(row['toques para voltar'] || row['back_taps']),
      exit_taps: parseNum(row['saídas'] || row['exit_taps']),
      interactions: parseNum(row['interações'] || row['interactions']),
      posted_at: postedAt,
      metadata: {
        caption: row['descrição'] || row['caption'] || null,
        permalink: row['link permanente'] || row['permalink'] || null,
        duration: duration,
        profile_visits: parseNum(row['visitas ao perfil']),
        sticker_taps: parseNum(row['toques em figurinhas']),
        link_clicks: parseNum(row['cliques no link']),
        navigation: parseNum(row['navegação']),
      },
    });
  }
  
  console.log(`Stories CSV: ${validStories.length} valid, ${invalidCount} invalid`);
  return validStories;
};

// Check if a row is a total/summary row (last row with aggregated metrics)
const isTotalRow = (row: Record<string, string>, allRows: Record<string, string>[]): boolean => {
  // Check if date is missing or invalid
  const dateStr = row['data'] || row['date'] || Object.values(row)[0] || '';
  if (!dateStr || dateStr.toLowerCase().includes('total')) return true;
  
  // Check if it's the last row with unusually high values compared to others
  const value = parseInt(row['primary'] || Object.values(row)[1] || '0') || 0;
  
  // Get average of other values (excluding this row)
  const otherValues = allRows
    .filter(r => r !== row)
    .map(r => parseInt(r['primary'] || Object.values(r)[1] || '0') || 0)
    .filter(v => v > 0);
  
  if (otherValues.length === 0) return false;
  
  const avg = otherValues.reduce((a, b) => a + b, 0) / otherValues.length;
  const max = Math.max(...otherValues);
  
  // If value is more than 10x the average and more than 2x the max, it's likely a total
  if (value > avg * 10 && value > max * 2) {
    console.log(`Detected total row: value=${value}, avg=${avg.toFixed(0)}, max=${max}`);
    return true;
  }
  
  return false;
};

// Process daily metrics CSV
const processDailyMetricsCSV = (
  data: Record<string, string>[], 
  clientId: string,
  metricType: string
) => {
  // Filter out total/summary rows
  const filteredData = data.filter(row => !isTotalRow(row, data));
  
  return filteredData.map(row => {
    let dateStr = row['data'] || row['date'] || Object.values(row)[0];
    if (dateStr?.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    
    const value = parseInt(row['primary'] || Object.values(row)[1] || '0') || 0;
    
    return {
      date: dateStr,
      [metricType]: value
    };
  });
};

interface DailyMetricData {
  reach?: number;
  followers?: number;
  views?: number;
  interactions?: number;
  profile_visits?: number;
  link_clicks?: number;
}

export const useSmartInstagramImport = (clientId: string, onImportComplete?: (platform: string, count: number, fileName?: string) => void) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: File[]) => {
      const fileNames = files.map(f => f.name).join(', ');
      const results: { type: string; count: number; invalid?: number }[] = [];
      const dailyMetrics: Map<string, DailyMetricData> = new Map();
      
      for (const file of files) {
        const text = await file.text();
        const parsedData = parseCSVRFC4180(text);
        const detected = detectCSVType(text, parsedData);
        
        console.log(`Processing ${file.name}: detected as ${detected.type}, ${parsedData.length} rows`);
        console.log('Sample row:', parsedData[0]);
        
        if (detected.type === "posts" && parsedData.length > 0) {
          const posts = processPostsCSV(parsedData, clientId);
          
          let successCount = 0;
          for (const post of posts) {
            const { error } = await supabase
              .from("instagram_posts")
              .upsert(post, {
                onConflict: "client_id,post_id",
              });
            
            if (error) {
              console.error("Error upserting post:", error, post);
            } else {
              successCount++;
            }
          }
          
          results.push({ 
            type: "Posts", 
            count: successCount,
            invalid: parsedData.length - posts.length
          });
        } else if (detected.type === "stories" && parsedData.length > 0) {
          // Process Stories CSV
          const stories = processStoriesCSV(parsedData, clientId);
          
          let successCount = 0;
          for (const story of stories) {
            const { error } = await supabase
              .from("instagram_stories")
              .upsert(story, {
                onConflict: "story_id,client_id",
              });
            
            if (error) {
              console.error("Error upserting story:", error, story);
            } else {
              successCount++;
            }
          }
          
          results.push({ 
            type: "Stories", 
            count: successCount,
            invalid: parsedData.length - stories.length
          });
        } else if (detected.type !== "unknown") {
          const metricMap: Record<string, string> = {
            reach: "reach",
            followers: "followers",
            views: "views",
            interactions: "interactions",
            profile_visits: "profile_visits",
            link_clicks: "link_clicks"
          };
          
          const metricKey = metricMap[detected.type];
          const dailyData = processDailyMetricsCSV(parsedData, clientId, metricKey);
          
          for (const item of dailyData) {
            if (!item.date) continue;
            
            const existing = dailyMetrics.get(item.date) || {};
            const metricValue = typeof item[metricKey] === 'number' ? item[metricKey] : 0;
            dailyMetrics.set(item.date, {
              ...existing,
              [metricKey]: metricValue
            } as DailyMetricData);
          }
          
          results.push({ type: detected.label, count: dailyData.length });
        }
      }
      
      // Save aggregated daily metrics to platform_metrics with MERGE logic
      if (dailyMetrics.size > 0) {
        for (const [date, metrics] of dailyMetrics) {
          // First, fetch existing record to preserve data that's not being updated
          const { data: existing } = await supabase
            .from("platform_metrics")
            .select("views, subscribers, metadata")
            .eq("client_id", clientId)
            .eq("platform", "instagram")
            .eq("metric_date", date)
            .single();

          const existingMeta = existing?.metadata ? 
            (typeof existing.metadata === 'string' ? JSON.parse(existing.metadata) : existing.metadata) : {};

          // Merge metadata - only overwrite fields that have new data
          const mergedMetadata = {
            ...existingMeta,
            ...(metrics.reach ? { reach: metrics.reach } : {}),
            ...(metrics.interactions ? { interactions: metrics.interactions } : {}),
            ...(metrics.profile_visits ? { profileVisits: metrics.profile_visits } : {}),
            ...(metrics.link_clicks ? { linkClicks: metrics.link_clicks } : {}),
          };

          const metricRecord = {
            client_id: clientId,
            platform: "instagram",
            metric_date: date,
            views: metrics.views || existing?.views || null,
            subscribers: metrics.followers || existing?.subscribers || null,
            metadata: mergedMetadata
          };
          
          const { error } = await supabase
            .from("platform_metrics")
            .upsert(metricRecord, {
              onConflict: "client_id,platform,metric_date",
            });
          
          if (error) {
            console.error("Error upserting daily metric:", error);
          }
        }
      }
      
      return results;
    },
    onSuccess: async (results, files) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      queryClient.invalidateQueries({ queryKey: ["performance-context", clientId] });
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
      
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);
      const fileNames = files.map(f => f.name).join(', ');
      
      // Call import complete callback for logging
      if (onImportComplete && totalCount > 0) {
        onImportComplete("instagram", totalCount, fileNames);
      }
      
      const summary = results.map(r => {
        if (r.invalid && r.invalid > 0) {
          return `${r.count} ${r.type} (${r.invalid} inválidos)`;
        }
        return `${r.count} ${r.type}`;
      }).join(", ");
      
      toast({
        title: "Importação concluída",
        description: `Importados: ${summary}`,
      });

      // Clear cached insights to trigger regeneration
      localStorage.removeItem(`insights-${clientId}`);
    },
    onError: (error) => {
      console.error("Import error:", error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível processar os arquivos CSV.",
        variant: "destructive",
      });
    },
  });
};
