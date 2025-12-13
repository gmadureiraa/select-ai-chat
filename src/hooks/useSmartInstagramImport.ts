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
  // Handle UTF-16 encoding (spaces between chars)
  const isUTF16 = text.includes(' " ') || text.includes(' , ');
  
  let cleanedText = text;
  if (isUTF16) {
    // Remove the extra spaces between characters
    cleanedText = text
      .split('\n')
      .map(line => {
        // Check if line has spaced characters
        if (line.includes(' " ')) {
          return line.replace(/ /g, '').replace(/"/g, '"');
        }
        return line;
      })
      .join('\n');
  }
  
  const lines = cleanedText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // Find the header line (skip metadata lines)
  let headerIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Data') || lines[i].includes('Identificação')) {
      headerIndex = i;
      break;
    }
  }
  
  const headerLine = lines[headerIndex];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  
  // Parse headers
  const headers = headerLine
    .split(delimiter)
    .map(h => cleanText(h.replace(/"/g, '').toLowerCase()));
  
  const results: Record<string, string>[] = [];
  
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('sep=')) continue;
    
    // Handle quoted values with commas
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === delimiter || char === ',') && !inQuotes) {
        values.push(cleanText(current.replace(/"/g, '')));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(cleanText(current.replace(/"/g, '')));
    
    if (values.length >= 2) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (values[idx] !== undefined) {
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
  const lowerText = text.toLowerCase();
  const firstRow = data[0] || {};
  const headers = Object.keys(firstRow);
  
  // Posts CSV - has post identification columns
  if (
    headers.some(h => h.includes('identificação do post') || h.includes('post_id')) ||
    lowerText.includes('identificação do post') ||
    lowerText.includes('link permanente')
  ) {
    return { type: "posts", label: "Posts do Instagram", data };
  }
  
  // Reach CSV
  if (lowerText.includes('"alcance"') || lowerText.includes('alcance')) {
    return { type: "reach", label: "Alcance", data };
  }
  
  // Followers CSV
  if (lowerText.includes('seguidores no instagram') || lowerText.includes('seguidores')) {
    return { type: "followers", label: "Seguidores", data };
  }
  
  // Views CSV
  if (lowerText.includes('"visualizações"') || lowerText.includes('visualizacoes')) {
    return { type: "views", label: "Visualizações", data };
  }
  
  // Interactions CSV
  if (lowerText.includes('interações') || lowerText.includes('interacoes')) {
    return { type: "interactions", label: "Interações", data };
  }
  
  // Profile visits CSV
  if (lowerText.includes('visitas ao perfil')) {
    return { type: "profile_visits", label: "Visitas ao Perfil", data };
  }
  
  // Link clicks CSV
  if (lowerText.includes('cliques no link')) {
    return { type: "link_clicks", label: "Cliques no Link", data };
  }
  
  return { type: "unknown", label: "Desconhecido", data };
};

// Process posts CSV
const processPostsCSV = (data: Record<string, string>[], clientId: string) => {
  return data
    .filter(row => row['comentário de dados']?.toLowerCase() === 'total' || !row['comentário de dados'])
    .map(row => {
      // Parse date from various formats
      let postedAt: string | null = null;
      const dateStr = row['horário de publicação'] || row['data'] || row['posted_at'];
      if (dateStr) {
        // Handle format: "12/10/2025 06:54"
        const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
        if (parts) {
          postedAt = `${parts[3]}-${parts[1]}-${parts[2]}T${parts[4]}:${parts[5]}:00`;
        } else {
          postedAt = dateStr;
        }
      }

      // Map post type
      let postType = 'image';
      const typeStr = (row['tipo de post'] || row['post_type'] || '').toLowerCase();
      if (typeStr.includes('carrossel') || typeStr.includes('carousel')) postType = 'carousel';
      else if (typeStr.includes('reel') || typeStr.includes('vídeo')) postType = 'reel';
      else if (typeStr.includes('story') || typeStr.includes('stories')) postType = 'story';

      return {
        client_id: clientId,
        post_id: row['identificação do post'] || row['post_id'] || `post_${Date.now()}_${Math.random()}`,
        post_type: postType,
        caption: row['descrição'] || row['caption'] || row['legenda'] || null,
        posted_at: postedAt,
        likes: parseInt(row['curtidas'] || row['likes'] || '0') || 0,
        comments: parseInt(row['comentários'] || row['comments'] || '0') || 0,
        shares: parseInt(row['compartilhamentos'] || row['shares'] || '0') || 0,
        saves: parseInt(row['salvamentos'] || row['saves'] || '0') || 0,
        reach: parseInt(row['alcance'] || row['reach'] || '0') || 0,
        impressions: parseInt(row['visualizações'] || row['impressions'] || '0') || 0,
        engagement_rate: parseFloat(row['taxa de engajamento'] || row['engagement_rate'] || '0') || 0,
        permalink: row['link permanente'] || row['permalink'] || null,
        metadata: {
          account_name: row['nome da conta'] || null,
          username: row['nome de usuário da conta'] || null,
          follows_from_post: parseInt(row['seguimentos'] || '0') || 0,
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
