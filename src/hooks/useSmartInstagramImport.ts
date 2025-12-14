import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type CSVType = 
  | "posts" 
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

// Clean UTF-16 encoded text from Instagram exports
const cleanText = (text: string): string => {
  return text
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

// Parse CSV with various encodings and formats
const parseCSV = (text: string): Record<string, string>[] => {
  // Handle UTF-16 encoding (spaces between chars like " D a t a ")
  let cleanedText = text;
  
  // Detect UTF-16 with BOM or spaced characters
  if (text.charCodeAt(0) === 0xFEFF || text.includes(' " ') || /^[^\n]*\s[A-Za-z]\s[A-Za-z]/.test(text)) {
    // Remove BOM and fix spaced UTF-16
    cleanedText = text
      .replace(/^\uFEFF/, '')
      .split('\n')
      .map(line => {
        // If line has alternating spaces (UTF-16 artifact)
        if (/^\s*"\s*[A-Z]\s+[a-z]/.test(line) || line.includes(' " ')) {
          return line.replace(/ /g, '').replace(/""/g, '"');
        }
        return line;
      })
      .join('\n');
  }
  
  const lines = cleanedText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // Find the header line (skip metadata lines like "sep=," or title lines)
  let headerIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    // Look for header indicators
    if (line.includes('data') && (line.includes('primary') || line.includes('identificação'))) {
      headerIndex = i;
      break;
    }
    // Posts CSV header pattern
    if (line.includes('identificação do post') || line.includes('link permanente')) {
      headerIndex = i;
      break;
    }
  }
  
  const headerLine = lines[headerIndex];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  
  // Parse headers - handle quoted headers
  const parseRow = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(cleanText(current.replace(/"/g, '')));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(cleanText(current.replace(/"/g, '')));
    return values;
  };
  
  const headers = parseRow(headerLine).map(h => h.toLowerCase());
  const results: Record<string, string>[] = [];
  
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('sep=')) continue;
    
    const values = parseRow(line);
    
    if (values.length >= 2) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (values[idx] !== undefined && header) {
          row[header] = values[idx];
        }
      });
      results.push(row);
    }
  }
  
  return results;
};

// Detect CSV type based on content and headers
const detectCSVType = (text: string, data: Record<string, string>[]): DetectedCSV => {
  // IMPORTANT: many Instagram exports come in UTF-16 with spaced characters,
  // so we should NOT rely only on the raw text. Prefer headers parsed from data.
  const lowerText = text.toLowerCase();
  const firstRow = data[0] || {};
  const headers = Object.keys(firstRow).map((h) => h.toLowerCase());

  const headerIncludes = (needle: string) =>
    headers.some((h) => h.includes(needle));

  // Posts CSV - has post identification columns
  if (
    headerIncludes("identificação do post") ||
    headerIncludes("identificacao do post") ||
    headerIncludes("post_id") ||
    lowerText.includes("identificação do post") ||
    lowerText.includes("link permanente")
  ) {
    return { type: "posts", label: "Posts do Instagram", data };
  }

  // Reach CSV
  if (headerIncludes("alcance") || lowerText.includes("\"alcance\"") || lowerText.includes("alcance")) {
    return { type: "reach", label: "Alcance", data };
  }

  // Followers CSV (daily gains)
  if (
    headerIncludes("seguidores no instagram") ||
    headerIncludes("seguidores") ||
    lowerText.includes("seguidores no instagram") ||
    lowerText.includes("seguidores")
  ) {
    return { type: "followers", label: "Seguidores", data };
  }

  // Views CSV
  if (headerIncludes("visualizações") || headerIncludes("visualizacoes") || lowerText.includes("\"visualizações\"") || lowerText.includes("visualizacoes")) {
    return { type: "views", label: "Visualizações", data };
  }

  // Interactions CSV
  if (headerIncludes("interações") || headerIncludes("interacoes") || lowerText.includes("interações") || lowerText.includes("interacoes")) {
    return { type: "interactions", label: "Interações", data };
  }

  // Profile visits CSV
  if (headerIncludes("visitas ao perfil") || lowerText.includes("visitas ao perfil")) {
    return { type: "profile_visits", label: "Visitas ao Perfil", data };
  }

  // Link clicks CSV
  if (headerIncludes("cliques no link") || lowerText.includes("cliques no link")) {
    return { type: "link_clicks", label: "Cliques no Link", data };
  }

  return { type: "unknown", label: "Desconhecido", data };
};

// Process posts CSV - handles the detailed Instagram export format
const processPostsCSV = (data: Record<string, string>[], clientId: string) => {
  return data
    .filter(row => {
      // Only process "Total" rows from Instagram exports, or rows without this field
      const commentData = row['comentário de dados']?.toLowerCase();
      return commentData === 'total' || !commentData;
    })
    .map(row => {
      // Parse date from various formats
      let postedAt: string | null = null;
      const dateStr = row['horário de publicação'] || row['data'] || row['posted_at'];
      if (dateStr) {
        // Handle format: "12/10/2025 06:54" (MM/DD/YYYY HH:mm)
        const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
        if (parts) {
          postedAt = `${parts[3]}-${parts[1]}-${parts[2]}T${parts[4]}:${parts[5]}:00`;
        } else {
          postedAt = dateStr;
        }
      }

      // Map post type from Portuguese
      let postType = 'image';
      const typeStr = (row['tipo de post'] || row['post_type'] || '').toLowerCase();
      if (typeStr.includes('carrossel') || typeStr.includes('carousel')) postType = 'carousel';
      else if (typeStr.includes('reel')) postType = 'reel';
      else if (typeStr.includes('story') || typeStr.includes('stories')) postType = 'story';
      else if (typeStr.includes('imagem') || typeStr.includes('image')) postType = 'image';

      // Parse all numeric fields carefully
      const parseNum = (val: string | undefined): number => {
        if (!val) return 0;
        const num = parseInt(val.replace(/[^\d-]/g, ''), 10);
        return isNaN(num) ? 0 : num;
      };

      return {
        client_id: clientId,
        post_id: row['identificação do post'] || row['post_id'] || `post_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        post_type: postType,
        caption: row['descrição'] || row['caption'] || row['legenda'] || null,
        posted_at: postedAt,
        likes: parseNum(row['curtidas'] || row['likes']),
        comments: parseNum(row['comentários'] || row['comments']),
        shares: parseNum(row['compartilhamentos'] || row['shares']),
        saves: parseNum(row['salvamentos'] || row['saves']),
        reach: parseNum(row['alcance'] || row['reach']),
        impressions: parseNum(row['visualizações'] || row['impressions'] || row['views']),
        engagement_rate: parseFloat(row['taxa de engajamento'] || row['engagement_rate'] || '0') || 0,
        permalink: row['link permanente'] || row['permalink'] || null,
        metadata: {
          account_name: row['nome da conta'] || null,
          username: row['nome de usuário da conta'] || null,
          follows_from_post: parseNum(row['seguimentos'] || row['follows']),
          duration_seconds: parseNum(row['duração (s)'] || row['duration']),
        }
      };
    });
};

// Process daily metrics CSV
const processDailyMetricsCSV = (
  data: Record<string, string>[], 
  clientId: string,
  metricType: string
) => {
  return data.map(row => {
    // Parse date
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

export const useSmartInstagramImport = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: File[]) => {
      const results: { type: string; count: number }[] = [];
      const dailyMetrics: Map<string, DailyMetricData> = new Map();
      
      for (const file of files) {
        const text = await file.text();
        const parsedData = parseCSV(text);
        const detected = detectCSVType(text, parsedData);
        
        console.log(`Processing ${file.name}: detected as ${detected.type}`, parsedData.slice(0, 2));
        
        if (detected.type === "posts" && parsedData.length > 0) {
          // Process posts
          const posts = processPostsCSV(parsedData, clientId);
          
          for (const post of posts) {
            const { error } = await supabase
              .from("instagram_posts")
              .upsert(post, {
                onConflict: "client_id,post_id",
              });
            
            if (error) {
              console.error("Error upserting post:", error);
            }
          }
          
          results.push({ type: "Posts", count: posts.length });
        } else if (detected.type !== "unknown") {
          // Process daily metrics
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
      
      // Save aggregated daily metrics to platform_metrics
      if (dailyMetrics.size > 0) {
        for (const [date, metrics] of dailyMetrics) {
          const metricRecord = {
            client_id: clientId,
            platform: "instagram",
            metric_date: date,
            views: metrics.views || null,
            subscribers: metrics.followers || null,
            likes: metrics.interactions || null,
            metadata: {
              reach: metrics.reach || null,
              profile_visits: metrics.profile_visits || null,
              link_clicks: metrics.link_clicks || null,
            }
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
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      
      const summary = results.map(r => `${r.count} ${r.type}`).join(", ");
      toast({
        title: "Importação concluída",
        description: `Importados: ${summary}`,
      });
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
