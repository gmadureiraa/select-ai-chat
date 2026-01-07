import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TwitterPost } from "@/types/twitter";

export const useTwitterPosts = (clientId: string, limit: number = 100) => {
  return useQuery({
    queryKey: ['twitter-posts', clientId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('twitter_posts')
        .select('*')
        .eq('client_id', clientId)
        .order('posted_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as TwitterPost[];
    },
    enabled: !!clientId,
  });
};

export const useTwitterMetrics = (clientId: string, limit: number = 365) => {
  return useQuery({
    queryKey: ['twitter-metrics', clientId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_metrics')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', 'twitter')
        .order('metric_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

interface ImportTwitterCSVParams {
  clientId: string;
  posts: Array<{
    tweet_id: string;
    content?: string | null;
    posted_at: string | null;
    impressions: number;
    engagements: number;
    engagement_rate: number;
    retweets: number;
    replies: number;
    likes: number;
    profile_clicks: number;
    url_clicks: number;
    hashtag_clicks: number;
    detail_expands: number;
    media_views: number;
    media_engagements: number;
  }>;
  dailyMetrics?: Array<{
    date: string;
    impressions: number;
    engagements: number;
    followers?: number;
  }>;
}

export const useImportTwitterCSV = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, posts, dailyMetrics }: ImportTwitterCSVParams) => {
      // Upsert posts
      if (posts.length > 0) {
        const { error: postsError } = await supabase
          .from('twitter_posts')
          .upsert(
            posts.map(p => ({
              client_id: clientId,
              ...p
            })),
            { onConflict: 'client_id,tweet_id' }
          );
        if (postsError) throw postsError;
      }

      // Insert daily metrics into platform_metrics
      if (dailyMetrics && dailyMetrics.length > 0) {
        for (const day of dailyMetrics) {
          const { error: metricsError } = await supabase
            .from('platform_metrics')
            .upsert({
              client_id: clientId,
              platform: 'twitter',
              metric_date: day.date,
              views: day.impressions,
              engagement_rate: day.engagements > 0 && day.impressions > 0 
                ? (day.engagements / day.impressions) * 100 
                : 0,
              subscribers: day.followers,
            }, { 
              onConflict: 'client_id,platform,metric_date'
            });
          if (metricsError) console.error('Error inserting metric:', metricsError);
        }
      }

      return { postsImported: posts.length, daysImported: dailyMetrics?.length || 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twitter-posts'] });
      queryClient.invalidateQueries({ queryKey: ['twitter-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    },
  });
};

// Parse Twitter Analytics CSV
export const parseTwitterCSV = (csvContent: string): {
  posts: ImportTwitterCSVParams['posts'];
  dailyMetrics: ImportTwitterCSVParams['dailyMetrics'];
} => {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return { posts: [], dailyMetrics: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : 
                    firstLine.includes(';') ? ';' : ',';

  // Parse headers
  const headers = parseCSVLine(lines[0], delimiter).map(h => 
    h.toLowerCase().trim().replace(/['"]/g, '')
  );

  const posts: ImportTwitterCSVParams['posts'] = [];
  const dailyMetricsMap = new Map<string, { impressions: number; engagements: number }>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim().replace(/['"]/g, '') || '';
    });

    // Try to find tweet ID
    const tweetId = row['tweet id'] || row['tweet_id'] || row['id'] || 
                    extractTweetIdFromPermalink(row['tweet permalink'] || row['permalink'] || '');

    if (!tweetId) continue;

    // Parse date
    const dateStr = row['time'] || row['date'] || row['posted_at'] || '';
    const postedAt = parseTwitterDate(dateStr);

    // Parse numeric values
    const impressions = parseNumber(row['impressions']);
    const engagements = parseNumber(row['engagements']);
    const retweets = parseNumber(row['retweets']);
    const replies = parseNumber(row['replies']);
    const likes = parseNumber(row['likes']);
    const profileClicks = parseNumber(row['user profile clicks'] || row['profile_clicks']);
    const urlClicks = parseNumber(row['url clicks'] || row['url_clicks']);
    const hashtagClicks = parseNumber(row['hashtag clicks'] || row['hashtag_clicks']);
    const detailExpands = parseNumber(row['detail expands'] || row['detail_expands']);
    const mediaViews = parseNumber(row['media views'] || row['media_views']);
    const mediaEngagements = parseNumber(row['media engagements'] || row['media_engagements']);

    const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

    posts.push({
      tweet_id: tweetId,
      content: row['tweet text'] || row['text'] || row['content'] || null,
      posted_at: postedAt,
      impressions,
      engagements,
      engagement_rate: engagementRate,
      retweets,
      replies,
      likes,
      profile_clicks: profileClicks,
      url_clicks: urlClicks,
      hashtag_clicks: hashtagClicks,
      detail_expands: detailExpands,
      media_views: mediaViews,
      media_engagements: mediaEngagements,
    });

    // Aggregate daily metrics
    if (postedAt) {
      const dateKey = postedAt.split('T')[0];
      const existing = dailyMetricsMap.get(dateKey) || { impressions: 0, engagements: 0 };
      dailyMetricsMap.set(dateKey, {
        impressions: existing.impressions + impressions,
        engagements: existing.engagements + engagements,
      });
    }
  }

  const dailyMetrics = Array.from(dailyMetricsMap.entries()).map(([date, data]) => ({
    date,
    impressions: data.impressions,
    engagements: data.engagements,
  }));

  return { posts, dailyMetrics };
};

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractTweetIdFromPermalink(permalink: string): string | null {
  const match = permalink.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

function parseTwitterDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  try {
    // Try ISO format first
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Try common Twitter formats: "2024-01-15 14:30 +0000"
    const parts = dateStr.split(' ');
    if (parts.length >= 2) {
      const date = new Date(`${parts[0]}T${parts[1]}Z`);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Try MM/DD/YYYY format
    const usFormat = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usFormat) {
      const [, month, day, year] = usFormat;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toISOString();
    }

    return null;
  } catch {
    return null;
  }
}
