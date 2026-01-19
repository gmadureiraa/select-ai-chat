import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ImportResult {
  success: boolean;
  count: number;
  type: "daily_performance" | "posts" | "subscribers" | "web_performance" | "link_clicks" | "top_urls" | "unknown";
  error?: string;
}

interface DailyMetrics {
  [date: string]: {
    delivered: number;
    openRate: number;
    clickRate: number;
    verifiedClickRate: number;
    subscribers: number;
    opens: number;
    clicks: number;
    unsubscribes: number;
    spamReports: number;
  };
}

// Parse date formats like "Feb 11, 2025" or "March 1, 2024, 12:00 AM"
function parseBeehiivDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Remove quotes and trim
  const cleanDate = dateStr.replace(/['"]/g, "").trim();
  
  // Handle "Month DD, YYYY" or "Month DD, YYYY, HH:MM AM/PM"
  const match = cleanDate.match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (match) {
    const months: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12",
      Jan: "01", Feb: "02", Mar: "03", Apr: "04",
      Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
    };
    
    const monthNum = months[match[1]];
    if (monthNum) {
      const day = match[2].padStart(2, "0");
      return `${match[3]}-${monthNum}-${day}`;
    }
  }
  
  return null;
}

// Parse numbers like "31,835" to 31835
function parseNumber(value: string): number {
  if (!value) return 0;
  const clean = value.replace(/['"]/g, "").replace(/,/g, "").trim();
  return parseInt(clean) || 0;
}

// Parse percentages like "36.66%" to 36.66
function parsePercentage(value: string): number {
  if (!value) return 0;
  const clean = value.replace(/['"]/g, "").replace(/%/g, "").trim();
  return parseFloat(clean) || 0;
}

// Detect CSV type based on headers
function detectCsvType(headers: string[]): "daily_performance" | "posts" | "subscribers" | "web_performance" | "link_clicks" | "top_urls" | "unknown" {
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/['"]/g, "").trim());
  
  // Check for posts CSV FIRST (has Subject or Title, Post ID, etc.) - more specific
  if (lowerHeaders.some(h => h.includes("subject") || h.includes("title")) && 
      lowerHeaders.some(h => h.includes("post id"))) {
    return "posts";
  }
  
  // Check for top_urls CSV (Position, url, total_email_clicks, total_unique_email_clicks)
  if (lowerHeaders.some(h => h === "position") && 
      lowerHeaders.some(h => h === "url") &&
      lowerHeaders.some(h => h.includes("email_clicks") || h.includes("email clicks"))) {
    return "top_urls";
  }
  
  // Check for link clicks CSV (URL, Verified Total Clicks, etc.) - has "verified" columns
  if (lowerHeaders.some(h => h.includes("url")) && 
      lowerHeaders.some(h => h.includes("verified"))) {
    return "link_clicks";
  }
  
  // Check for web performance CSV (Date, Web Views, Web Clicks, Web Click Rate)
  if (lowerHeaders.some(h => h.includes("web views") || h.includes("web clicks"))) {
    return "web_performance";
  }
  
  // Check for daily performance CSV (Date, Delivered, Open Rate, Click-Through Rate)
  if (lowerHeaders.includes("delivered") && lowerHeaders.includes("open rate")) {
    return "daily_performance";
  }
  
  // Check for subscriber acquisitions (Created At, Acquisition Source, Count)
  if ((lowerHeaders.includes("acquisition source") || lowerHeaders.some(h => h.includes("acquisition"))) && 
      lowerHeaders.includes("count")) {
    return "subscribers";
  }
  
  return "unknown";
}

// Parse CSV handling quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

export function useSmartNewsletterImport(clientId: string, onImportComplete?: (platform: string, count: number, fileName?: string) => void) {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importFile = useCallback(async (file: File) => {
    setIsImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      
      if (lines.length < 2) {
        throw new Error("CSV vazio ou inválido");
      }

      const headers = parseCSVLine(lines[0]);
      const csvType = detectCsvType(headers);
      
      if (csvType === "unknown") {
        throw new Error("Formato de CSV não reconhecido. Use CSVs do Beehiiv.");
      }

      let count = 0;

      if (csvType === "daily_performance") {
        // Process daily performance metrics
        const dateIdx = headers.findIndex(h => h.toLowerCase().includes("date"));
        const deliveredIdx = headers.findIndex(h => h.toLowerCase().includes("delivered"));
        const openRateIdx = headers.findIndex(h => h.toLowerCase().includes("open rate"));
        const clickRateIdx = headers.findIndex(h => h.toLowerCase().includes("click-through rate") || h.toLowerCase().includes("click rate"));
        const verifiedClickIdx = headers.findIndex(h => h.toLowerCase().includes("verified"));

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const date = parseBeehiivDate(values[dateIdx]);
          
          if (!date) continue;

          const delivered = parseNumber(values[deliveredIdx]);
          const openRate = parsePercentage(values[openRateIdx]);
          const clickRate = parsePercentage(values[clickRateIdx]);
          const verifiedClickRate = verifiedClickIdx >= 0 ? parsePercentage(values[verifiedClickIdx]) : clickRate;

          await supabase.from("platform_metrics").upsert({
            client_id: clientId,
            platform: "newsletter",
            metric_date: date,
            views: delivered,
            open_rate: openRate,
            click_rate: clickRate,
            metadata: {
              delivered,
              verifiedClickRate,
            }
          }, { onConflict: "client_id,platform,metric_date" });

          count++;
        }
      } else if (csvType === "posts") {
        // Process individual posts - save each post with its subject/title
        const dateIdx = headers.findIndex(h => h.toLowerCase().includes("date"));
        const subjectIdx = headers.findIndex(h => h.toLowerCase().includes("subject") || h.toLowerCase().includes("title"));
        const sentIdx = headers.findIndex(h => h.toLowerCase() === "sent");
        const deliveredIdx = headers.findIndex(h => h.toLowerCase() === "delivered");
        const totalOpensIdx = headers.findIndex(h => h.toLowerCase().includes("total opens"));
        const uniqueOpensIdx = headers.findIndex(h => h.toLowerCase().includes("unique opens"));
        const openRateIdx = headers.findIndex(h => h.toLowerCase() === "open rate");
        const uniqueClicksIdx = headers.findIndex(h => h.toLowerCase().includes("unique clicks"));
        const clickRateIdx = headers.findIndex(h => h.toLowerCase() === "click-through rate");
        const unsubscribedIdx = headers.findIndex(h => h.toLowerCase().includes("unsubscribed"));
        const spamIdx = headers.findIndex(h => h.toLowerCase().includes("spam reported"));
        const postIdIdx = headers.findIndex(h => h.toLowerCase().includes("post id"));
        // NEW: Web URL column
        const webUrlIdx = headers.findIndex(h => 
          h.toLowerCase().includes("web url") || 
          h.toLowerCase() === "url" ||
          h.toLowerCase().includes("post url") ||
          h.toLowerCase().includes("link")
        );

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const date = parseBeehiivDate(values[dateIdx]);
          
          if (!date) continue;

          const subject = values[subjectIdx]?.replace(/['"]/g, "").trim() || "";
          const postId = values[postIdIdx]?.replace(/['"]/g, "").trim() || `post-${date}-${i}`;
          const sent = parseNumber(values[sentIdx]);
          const delivered = parseNumber(values[deliveredIdx]);
          const totalOpens = parseNumber(values[totalOpensIdx]);
          const uniqueOpens = parseNumber(values[uniqueOpensIdx]);
          const openRate = parsePercentage(values[openRateIdx]);
          const uniqueClicks = parseNumber(values[uniqueClicksIdx]);
          const clickRate = parsePercentage(values[clickRateIdx]);
          const unsubscribes = parseNumber(values[unsubscribedIdx]);
          const spamReports = parseNumber(values[spamIdx]);
          // NEW: Extract Web URL
          const webUrl = webUrlIdx >= 0 ? values[webUrlIdx]?.replace(/['"]/g, "").trim() : "";

          // Skip posts with no data (likely drafts or failed sends)
          if (sent === 0 && delivered === 0) continue;

          // Check if this post already exists by post_id
          const { data: existingPost } = await supabase
            .from("platform_metrics")
            .select("id")
            .eq("client_id", clientId)
            .eq("platform", "newsletter_post")
            .eq("metadata->>post_id", postId)
            .maybeSingle();

          if (existingPost) {
            // Update existing post
            await supabase.from("platform_metrics").update({
              metric_date: date,
              views: delivered,
              open_rate: openRate,
              click_rate: clickRate,
              metadata: {
                post_id: postId,
                subject,
                url: webUrl, // NEW: Include URL
                sent,
                delivered,
                totalOpens,
                uniqueOpens,
                uniqueClicks,
                unsubscribes,
                spamReports,
              }
            }).eq("id", existingPost.id);
          } else {
            // Insert new post with unique platform identifier
            await supabase.from("platform_metrics").insert({
              client_id: clientId,
              platform: "newsletter_post",
              metric_date: date,
              views: delivered,
              open_rate: openRate,
              click_rate: clickRate,
              metadata: {
                post_id: postId,
                subject,
                url: webUrl, // NEW: Include URL
                sent,
                delivered,
                totalOpens,
                uniqueOpens,
                uniqueClicks,
                unsubscribes,
                spamReports,
              }
            });
          }

          count++;
        }
      } else if (csvType === "subscribers") {
        // Process subscriber acquisitions by date
        const dateIdx = headers.findIndex(h => h.toLowerCase().includes("created at") || h.toLowerCase().includes("date"));
        const countIdx = headers.findIndex(h => h.toLowerCase() === "count");
        const sourceIdx = headers.findIndex(h => h.toLowerCase().includes("acquisition source"));
        
        // Group by date
        const subscribersByDate: Record<string, { total: number; sources: Record<string, number> }> = {};
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const date = parseBeehiivDate(values[dateIdx]);
          
          if (!date) continue;
          
          const subCount = parseNumber(values[countIdx]);
          const source = values[sourceIdx]?.replace(/['"]/g, "").trim() || "Unknown";
          
          if (!subscribersByDate[date]) {
            subscribersByDate[date] = { total: 0, sources: {} };
          }
          
          subscribersByDate[date].total += subCount;
          subscribersByDate[date].sources[source] = (subscribersByDate[date].sources[source] || 0) + subCount;
        }
        
        // Upsert subscriber data by date
        for (const [date, data] of Object.entries(subscribersByDate)) {
          // Get existing metrics for this date
          const { data: existingMetric } = await supabase
            .from("platform_metrics")
            .select("id, metadata")
            .eq("client_id", clientId)
            .eq("platform", "newsletter")
            .eq("metric_date", date)
            .maybeSingle();
          
          if (existingMetric) {
            // Update existing with subscriber data
            await supabase.from("platform_metrics").update({
              metadata: {
                ...(existingMetric.metadata as Record<string, any> || {}),
                newSubscribers: data.total,
                acquisitionSources: data.sources,
              }
            }).eq("id", existingMetric.id);
          } else {
            // Insert new record with subscriber data
            await supabase.from("platform_metrics").insert({
              client_id: clientId,
              platform: "newsletter",
              metric_date: date,
              metadata: {
                newSubscribers: data.total,
                acquisitionSources: data.sources,
              }
            });
          }
          
          count++;
        }
      } else if (csvType === "web_performance") {
        // Process web performance metrics (Date, Web Views, Web Clicks, Web Click Rate)
        const dateIdx = headers.findIndex(h => h.toLowerCase().includes("date"));
        const webViewsIdx = headers.findIndex(h => h.toLowerCase().includes("web views"));
        const webClicksIdx = headers.findIndex(h => h.toLowerCase().includes("web clicks") && !h.toLowerCase().includes("rate"));
        const webClickRateIdx = headers.findIndex(h => h.toLowerCase().includes("web click rate"));

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const date = parseBeehiivDate(values[dateIdx]);
          
          if (!date) continue;

          const webViews = parseNumber(values[webViewsIdx]);
          const webClicks = parseNumber(values[webClicksIdx]);
          const webClickRate = parsePercentage(values[webClickRateIdx]);

          // Get existing metrics for this date
          const { data: existingMetric } = await supabase
            .from("platform_metrics")
            .select("id, metadata")
            .eq("client_id", clientId)
            .eq("platform", "newsletter")
            .eq("metric_date", date)
            .maybeSingle();
          
          if (existingMetric) {
            // Update existing with web performance data
            await supabase.from("platform_metrics").update({
              metadata: {
                ...(existingMetric.metadata as Record<string, any> || {}),
                webViews,
                webClicks,
                webClickRate,
              }
            }).eq("id", existingMetric.id);
          } else {
            // Insert new record with web performance data
            await supabase.from("platform_metrics").insert({
              client_id: clientId,
              platform: "newsletter",
              metric_date: date,
              metadata: {
                webViews,
                webClicks,
                webClickRate,
              }
            });
          }

          count++;
        }
      } else if (csvType === "link_clicks") {
        // Process link clicks aggregate data
        // This CSV has URLs with click counts - we'll aggregate totals
        const urlIdx = headers.findIndex(h => h.toLowerCase().includes("url") && !h.toLowerCase().includes("full"));
        const verifiedTotalIdx = headers.findIndex(h => h.toLowerCase().includes("verified total"));
        const verifiedUniqueIdx = headers.findIndex(h => h.toLowerCase().includes("verified unique"));
        const totalWebClicksIdx = headers.findIndex(h => h.toLowerCase().includes("total web clicks"));
        const uniqueWebClicksIdx = headers.findIndex(h => h.toLowerCase().includes("total unique web"));

        // Aggregate link clicks data
        let totalVerifiedClicks = 0;
        let totalVerifiedUniqueClicks = 0;
        let totalWebClicks = 0;
        let totalUniqueWebClicks = 0;
        const topLinks: Array<{ url: string; clicks: number }> = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const url = values[urlIdx]?.replace(/['"]/g, "").trim() || "";
          
          if (!url) continue;

          const verifiedTotal = parseNumber(values[verifiedTotalIdx]);
          const verifiedUnique = parseNumber(values[verifiedUniqueIdx]);
          const webClicks = parseNumber(values[totalWebClicksIdx]);
          const uniqueWeb = parseNumber(values[uniqueWebClicksIdx]);

          totalVerifiedClicks += verifiedTotal;
          totalVerifiedUniqueClicks += verifiedUnique;
          totalWebClicks += webClicks;
          totalUniqueWebClicks += uniqueWeb;

          const totalClicks = verifiedTotal + webClicks;
          if (totalClicks > 0 && topLinks.length < 20) {
            topLinks.push({ url, clicks: totalClicks });
          }
        }

        // Sort top links by clicks
        topLinks.sort((a, b) => b.clicks - a.clicks);

        // Store as aggregate data with today's date
        const today = new Date().toISOString().split("T")[0];
        
        const { data: existingMetric } = await supabase
          .from("platform_metrics")
          .select("id, metadata")
          .eq("client_id", clientId)
          .eq("platform", "newsletter")
          .eq("metric_date", today)
          .maybeSingle();
        
        const linkClicksData = {
          totalVerifiedClicks,
          totalVerifiedUniqueClicks,
          totalWebClicks,
          totalUniqueWebClicks,
          topLinks: topLinks.slice(0, 10),
          linkClicksImportedAt: new Date().toISOString(),
        };

        if (existingMetric) {
          await supabase.from("platform_metrics").update({
            metadata: {
              ...(existingMetric.metadata as Record<string, any> || {}),
              ...linkClicksData,
            }
          }).eq("id", existingMetric.id);
        } else {
          await supabase.from("platform_metrics").insert({
            client_id: clientId,
            platform: "newsletter",
            metric_date: today,
            metadata: linkClicksData,
          });
        }

        count = topLinks.length;
      } else if (csvType === "top_urls") {
        // Process top URLs CSV (Position, url, total_email_clicks, total_unique_email_clicks)
        const positionIdx = headers.findIndex(h => h.toLowerCase() === "position");
        const urlIdx = headers.findIndex(h => h.toLowerCase() === "url");
        const totalClicksIdx = headers.findIndex(h => h.toLowerCase().includes("total_email_clicks") || h.toLowerCase().includes("total email clicks"));
        const uniqueClicksIdx = headers.findIndex(h => h.toLowerCase().includes("unique_email_clicks") || h.toLowerCase().includes("unique email clicks"));

        const topUrls: Array<{ position: number; url: string; totalClicks: number; uniqueClicks: number }> = [];
        let totalEmailClicks = 0;
        let totalUniqueEmailClicks = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const position = parseNumber(values[positionIdx]);
          const url = values[urlIdx]?.replace(/['"]/g, "").trim() || "";
          
          if (!url) continue;

          const totalClicks = parseNumber(values[totalClicksIdx]);
          const uniqueClicks = parseNumber(values[uniqueClicksIdx]);

          totalEmailClicks += totalClicks;
          totalUniqueEmailClicks += uniqueClicks;

          if (topUrls.length < 20) {
            topUrls.push({ position, url, totalClicks, uniqueClicks });
          }
        }

        // Store as aggregate data with today's date
        const today = new Date().toISOString().split("T")[0];
        
        const { data: existingMetric } = await supabase
          .from("platform_metrics")
          .select("id, metadata")
          .eq("client_id", clientId)
          .eq("platform", "newsletter")
          .eq("metric_date", today)
          .maybeSingle();
        
        const topUrlsData = {
          totalEmailClicks,
          totalUniqueEmailClicks,
          topUrls: topUrls.slice(0, 10),
          topUrlsImportedAt: new Date().toISOString(),
        };

        if (existingMetric) {
          await supabase.from("platform_metrics").update({
            metadata: {
              ...(existingMetric.metadata as Record<string, any> || {}),
              ...topUrlsData,
            }
          }).eq("id", existingMetric.id);
        } else {
          await supabase.from("platform_metrics").insert({
            client_id: clientId,
            platform: "newsletter",
            metric_date: today,
            metadata: topUrlsData,
          });
        }

        count = topUrls.length;
      }
      const importResult: ImportResult = { success: true, count, type: csvType };
      setResult(importResult);
      
      // Log import to history
      if (count > 0) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await supabase.from("import_history").insert({
            client_id: clientId,
            platform: "newsletter",
            records_count: count,
            file_name: file.name,
            status: "completed",
            user_id: userData.user.id,
            metadata: { type: csvType }
          });
        }
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
      localStorage.removeItem(`insights-${clientId}`);

      // Call import complete callback for logging
      if (onImportComplete && count > 0) {
        onImportComplete("newsletter", count, file.name);
      }

      const typeLabels = {
        daily_performance: "Performance Diária",
        posts: "Posts/Edições",
        subscribers: "Novos Assinantes",
        web_performance: "Performance Web",
        link_clicks: "Cliques em Links",
        top_urls: "Top URLs",
        unknown: "Dados"
      };

      toast({
        title: "Importação concluída",
        description: `${count} registros de ${typeLabels[csvType]} importados com sucesso.`
      });

      return importResult;
    } catch (error: any) {
      const importResult: ImportResult = {
        success: false,
        count: 0,
        type: "unknown",
        error: error.message
      };
      setResult(importResult);
      
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive"
      });

      return importResult;
    } finally {
      setIsImporting(false);
    }
  }, [clientId, queryClient, toast]);

  const importMultipleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const results: ImportResult[] = [];

    for (const file of fileArray) {
      if (file.name.endsWith(".csv")) {
        const result = await importFile(file);
        results.push(result);
      }
    }

    return results;
  }, [importFile]);

  return {
    importFile,
    importMultipleFiles,
    isImporting,
    result,
    reset: () => setResult(null)
  };
}
