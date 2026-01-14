import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LinkedInPost, LinkedInExcelData, LinkedInDailyMetric } from "@/types/linkedin";
import * as XLSX from "xlsx";

export const useLinkedInPosts = (clientId: string, limit: number = 100) => {
  return useQuery({
    queryKey: ["linkedin-posts", clientId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_posts")
        .select("*")
        .eq("client_id", clientId)
        .order("posted_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as LinkedInPost[];
    },
    enabled: !!clientId,
  });
};

interface ImportLinkedInParams {
  clientId: string;
  posts: LinkedInExcelData["posts"];
  dailyMetrics?: LinkedInDailyMetric[];
  followers?: { total: number; daily: Array<{ date: string; new_followers: number }> };
}

export const useImportLinkedInExcel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, posts, dailyMetrics, followers }: ImportLinkedInParams) => {
      // Upsert posts
      if (posts.length > 0) {
        const { error: postsError } = await supabase
          .from("linkedin_posts")
          .upsert(
            posts.map((p) => ({
              client_id: clientId,
              post_id: p.post_id,
              post_url: p.post_url,
              posted_at: p.posted_at,
              impressions: p.impressions,
              engagements: p.engagements,
              engagement_rate: p.engagement_rate,
            })),
            { onConflict: "client_id,post_id" }
          );
        if (postsError) throw postsError;
      }

      // Insert daily metrics into platform_metrics
      if (dailyMetrics && dailyMetrics.length > 0) {
        for (const day of dailyMetrics) {
          const { error: metricsError } = await supabase
            .from("platform_metrics")
            .upsert(
              {
                client_id: clientId,
                platform: "linkedin",
                metric_date: day.date,
                views: day.impressions,
                engagement_rate:
                  day.engagements > 0 && day.impressions > 0
                    ? (day.engagements / day.impressions) * 100
                    : 0,
                subscribers: day.followers,
              },
              {
                onConflict: "client_id,platform,metric_date",
              }
            );
          if (metricsError) console.error("Error inserting metric:", metricsError);
        }
      }

      return { postsImported: posts.length, daysImported: dailyMetrics?.length || 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["performance-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["import-history"] });
    },
  });
};

// Parse LinkedIn Analytics Excel file
export const parseLinkedInExcel = (buffer: ArrayBuffer): LinkedInExcelData => {
  const workbook = XLSX.read(buffer, { type: "array" });
  
  const posts: LinkedInExcelData["posts"] = [];
  const dailyMetrics: LinkedInDailyMetric[] = [];
  const followersDaily: Array<{ date: string; new_followers: number }> = [];
  let totalFollowers = 0;

  // Page 2: Daily metrics (Data, Impressões, Engajamento)
  if (workbook.SheetNames.length > 1) {
    const dailySheet = workbook.Sheets[workbook.SheetNames[1]];
    const dailyData = XLSX.utils.sheet_to_json<unknown[]>(dailySheet, { header: 1 });
    
    // Skip header row
    for (let i = 1; i < dailyData.length; i++) {
      const row = dailyData[i] as unknown[];
      if (!row || !Array.isArray(row) || row.length < 2) continue;
      
      const dateValue = row[0];
      const impressions = parseNumber(row[1]);
      const engagements = parseNumber(row[2]);
      
      const parsedDate = parseExcelDate(dateValue);
      if (parsedDate) {
        dailyMetrics.push({
          date: parsedDate,
          impressions,
          engagements,
        });
      }
    }
  }

  // Page 3: Posts with engagement and impressions (complex layout with 2 tables side by side)
  if (workbook.SheetNames.length > 2) {
    const postsSheet = workbook.Sheets[workbook.SheetNames[2]];
    const postsData = XLSX.utils.sheet_to_json<unknown[]>(postsSheet, { header: 1 });
    
    // The structure has 2 side-by-side tables:
    // Cols 0-2: URL | Date | Engagement
    // Cols 4-6: URL | Date | Impressions
    
    // Create maps to merge data
    const engagementMap = new Map<string, { url: string; date: string; engagements: number }>();
    const impressionsMap = new Map<string, number>();
    
    // Start from row 3 (skip headers)
    for (let i = 3; i < postsData.length; i++) {
      const row = postsData[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;
      
      // Left table: Engagement data
      if (row[0] && typeof row[0] === 'string' && row[0].includes('linkedin.com')) {
        const url = row[0] as string;
        const postId = extractLinkedInPostId(url);
        const dateValue = row[1];
        const engagements = parseNumber(row[2]);
        
        if (postId) {
          engagementMap.set(postId, {
            url,
            date: parseExcelDate(dateValue) || '',
            engagements,
          });
        }
      }
      
      // Right table: Impressions data (columns 4-6)
      if (row[4] && typeof row[4] === 'string' && row[4].includes('linkedin.com')) {
        const url = row[4] as string;
        const postId = extractLinkedInPostId(url);
        const impressions = parseNumber(row[6]);
        
        if (postId) {
          impressionsMap.set(postId, impressions);
        }
      }
    }
    
    // Merge engagement and impressions data
    for (const [postId, engData] of engagementMap) {
      const impressions = impressionsMap.get(postId) || 0;
      const engagementRate = impressions > 0 ? (engData.engagements / impressions) * 100 : 0;
      
      posts.push({
        post_id: postId,
        post_url: engData.url,
        posted_at: engData.date || null,
        impressions,
        engagements: engData.engagements,
        engagement_rate: engagementRate,
      });
    }
    
    // Add posts that only have impressions (no engagement)
    for (const [postId, impressions] of impressionsMap) {
      if (!engagementMap.has(postId)) {
        posts.push({
          post_id: postId,
          post_url: `https://www.linkedin.com/feed/update/urn:li:activity:${postId}`,
          posted_at: null,
          impressions,
          engagements: 0,
          engagement_rate: 0,
        });
      }
    }
  }

  // Page 4: Followers
  if (workbook.SheetNames.length > 3) {
    const followersSheet = workbook.Sheets[workbook.SheetNames[3]];
    const followersData = XLSX.utils.sheet_to_json<unknown[]>(followersSheet, { header: 1 });
    
    // First row has total followers
    if (followersData[0] && Array.isArray(followersData[0])) {
      const firstRow = followersData[0] as unknown[];
      totalFollowers = parseNumber(firstRow[1]);
    }
    
    // Daily followers from row 3 onwards
    for (let i = 3; i < followersData.length; i++) {
      const row = followersData[i] as unknown[];
      if (!row || !Array.isArray(row) || row.length < 2) continue;
      
      const dateValue = row[0];
      const newFollowers = parseNumber(row[1]);
      
      const parsedDate = parseExcelDate(dateValue);
      if (parsedDate) {
        followersDaily.push({
          date: parsedDate,
          new_followers: newFollowers,
        });
      }
    }
  }

  // Add follower data to daily metrics
  const followerMap = new Map(followersDaily.map(f => [f.date, f.new_followers]));
  dailyMetrics.forEach(dm => {
    const newFollowers = followerMap.get(dm.date);
    if (newFollowers !== undefined) {
      dm.followers = newFollowers;
    }
  });

  return {
    posts,
    dailyMetrics,
    followers: {
      total: totalFollowers,
      daily: followersDaily,
    },
  };
};

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractLinkedInPostId(url: string): string | null {
  // Extract activity ID from LinkedIn URL
  // Format: https://www.linkedin.com/feed/update/urn:li:activity:7359572815139790848
  const match = url.match(/activity:(\d+)/);
  return match ? match[1] : null;
}

function parseExcelDate(value: unknown): string | null {
  if (!value) return null;
  
  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    // Excel dates are days since 1900-01-01 (with a bug for 1900 being a leap year)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // Handle string dates in DD/MM/YYYY format
  if (typeof value === 'string') {
    const ddmmyyyy = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try ISO format
    if (value.includes('-')) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  return null;
}
