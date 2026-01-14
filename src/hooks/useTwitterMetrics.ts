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
      // Upsert posts - mark content as synced since CSV includes the text
      if (posts.length > 0) {
        const { error: postsError } = await supabase
          .from('twitter_posts')
          .upsert(
            posts.map(p => ({
              client_id: clientId,
              ...p,
              full_content: p.content || null,
              content_synced_at: p.content ? new Date().toISOString() : null,
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

export const useUpdateTwitterPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<TwitterPost, 'metadata'>> }) => {
      const { error } = await supabase
        .from('twitter_posts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twitter-posts'] });
    },
  });
};

// Parse Twitter Analytics CSV - supports multiple formats
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
  const dailyMetricsMap = new Map<string, { impressions: number; engagements: number; followers?: number }>();

  // Detect format type
  const isNewFormat = headers.includes('post id') || headers.includes('post text') || headers.includes('post link');
  const isOverviewFormat = headers.includes('date') && headers.includes('impressions') && !headers.includes('post id') && !headers.includes('tweet id');

  // If it's a daily overview format (not posts), parse only daily metrics
  if (isOverviewFormat) {
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      if (values.length < 2) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim().replace(/['"]/g, '') || '';
      });

      const dateStr = row['date'] || '';
      const parsedDate = parseTwitterDate(dateStr);
      if (!parsedDate) continue;

      const dateKey = parsedDate.split('T')[0];
      const impressions = parseNumber(row['impressions']);
      const engagements = parseNumber(row['engagements']);
      const newFollows = parseNumber(row['new follows']);
      const unfollows = parseNumber(row['unfollows']);

      const existing = dailyMetricsMap.get(dateKey) || { impressions: 0, engagements: 0 };
      dailyMetricsMap.set(dateKey, {
        impressions: existing.impressions + impressions,
        engagements: existing.engagements + engagements,
        followers: newFollows - unfollows,
      });
    }

    const dailyMetrics = Array.from(dailyMetricsMap.entries()).map(([date, data]) => ({
      date,
      impressions: data.impressions,
      engagements: data.engagements,
      followers: data.followers,
    }));

    return { posts: [], dailyMetrics };
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim().replace(/['"]/g, '') || '';
    });

    // Try to find tweet ID - support both old and new formats
    let tweetId = row['tweet id'] || row['tweet_id'] || row['id'] || row['post id'] || '';
    
    // Extract from post link if not found
    if (!tweetId && row['post link']) {
      tweetId = extractTweetIdFromPermalink(row['post link']) || '';
    }
    if (!tweetId) {
      tweetId = extractTweetIdFromPermalink(row['tweet permalink'] || row['permalink'] || '');
    }

    if (!tweetId) continue;

    // Parse date - support new format "Wed, Jan 14, 2026"
    const dateStr = row['time'] || row['date'] || row['posted_at'] || '';
    const postedAt = parseTwitterDate(dateStr);

    // Parse numeric values - support both old column names and new format
    const impressions = parseNumber(row['impressions']);
    const engagements = parseNumber(row['engagements']);
    const likes = parseNumber(row['likes']);
    const retweets = parseNumber(row['retweets'] || row['reposts']);
    const replies = parseNumber(row['replies']);
    const bookmarks = parseNumber(row['bookmarks']);
    const shares = parseNumber(row['shares']);
    const newFollows = parseNumber(row['new follows']);
    const profileClicks = parseNumber(row['user profile clicks'] || row['profile_clicks'] || row['profile visits']);
    const urlClicks = parseNumber(row['url clicks'] || row['url_clicks']);
    const hashtagClicks = parseNumber(row['hashtag clicks'] || row['hashtag_clicks']);
    const detailExpands = parseNumber(row['detail expands'] || row['detail_expands']);
    const permalinkClicks = parseNumber(row['permalink clicks']);
    const mediaViews = parseNumber(row['media views'] || row['media_views']);
    const mediaEngagements = parseNumber(row['media engagements'] || row['media_engagements']);

    const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

    // Get content - support both old and new format
    const content = row['tweet text'] || row['text'] || row['content'] || row['post text'] || null;

    posts.push({
      tweet_id: tweetId,
      content,
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
  if (!permalink) return null;
  // Match status/ID in various twitter URL formats
  const match = permalink.match(/(?:status|statuses)\/(\d+)/);
  return match ? match[1] : null;
}

function parseTwitterDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  try {
    // Try ISO format first
    if (dateStr.includes('T') || (dateStr.includes('-') && !dateStr.includes(','))) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Parse format like "Wed, Jan 14, 2026" or "Tue, Jan 13, 2026"
    const newFormatMatch = dateStr.match(/^\w{3},\s+(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
    if (newFormatMatch) {
      const [, monthStr, day, year] = newFormatMatch;
      const months: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const month = months[monthStr];
      if (month !== undefined) {
        const date = new Date(parseInt(year), month, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }

    // Try common Twitter formats: "2024-01-15 14:30 +0000"
    const parts = dateStr.split(' ');
    if (parts.length >= 2 && parts[0].includes('-')) {
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
