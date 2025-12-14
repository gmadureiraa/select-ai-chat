import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ImportResult {
  success: boolean;
  count: number;
  type: "daily_performance" | "posts" | "subscribers" | "unknown";
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
function detectCsvType(headers: string[]): "daily_performance" | "posts" | "subscribers" | "unknown" {
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/['"]/g, "").trim());
  
  // Check for daily performance CSV (Date, Delivered, Open Rate, Click-Through Rate)
  if (lowerHeaders.includes("delivered") && lowerHeaders.includes("open rate")) {
    return "daily_performance";
  }
  
  // Check for posts CSV (has Subject or Title, Post ID, etc.)
  if (lowerHeaders.some(h => h.includes("subject") || h.includes("title")) && 
      lowerHeaders.some(h => h.includes("post id"))) {
    return "posts";
  }
  
  // Check for subscriber acquisitions (Created At, Acquisition Source, Count)
  if (lowerHeaders.includes("acquisition source") && lowerHeaders.includes("count")) {
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

export function useSmartNewsletterImport(clientId: string) {
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
        // Process individual posts - aggregate by date
        const dateIdx = headers.findIndex(h => h.toLowerCase().includes("date"));
        const sentIdx = headers.findIndex(h => h.toLowerCase() === "sent");
        const deliveredIdx = headers.findIndex(h => h.toLowerCase() === "delivered");
        const totalOpensIdx = headers.findIndex(h => h.toLowerCase().includes("total opens"));
        const uniqueOpensIdx = headers.findIndex(h => h.toLowerCase().includes("unique opens"));
        const openRateIdx = headers.findIndex(h => h.toLowerCase() === "open rate");
        const uniqueClicksIdx = headers.findIndex(h => h.toLowerCase().includes("unique clicks"));
        const clickRateIdx = headers.findIndex(h => h.toLowerCase() === "click-through rate");
        const unsubscribedIdx = headers.findIndex(h => h.toLowerCase().includes("unsubscribed"));
        const spamIdx = headers.findIndex(h => h.toLowerCase().includes("spam reported"));

        const dailyData: DailyMetrics = {};

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const date = parseBeehiivDate(values[dateIdx]);
          
          if (!date) continue;

          if (!dailyData[date]) {
            dailyData[date] = {
              delivered: 0,
              openRate: 0,
              clickRate: 0,
              verifiedClickRate: 0,
              subscribers: 0,
              opens: 0,
              clicks: 0,
              unsubscribes: 0,
              spamReports: 0,
            };
          }

          dailyData[date].delivered += parseNumber(values[deliveredIdx]);
          dailyData[date].opens += parseNumber(values[totalOpensIdx >= 0 ? totalOpensIdx : uniqueOpensIdx]);
          dailyData[date].clicks += parseNumber(values[uniqueClicksIdx]);
          dailyData[date].unsubscribes += parseNumber(values[unsubscribedIdx]);
          dailyData[date].spamReports += parseNumber(values[spamIdx]);
          
          // Take the average open/click rate for the day
          const openRate = parsePercentage(values[openRateIdx]);
          const clickRate = parsePercentage(values[clickRateIdx]);
          
          if (openRate > 0) {
            dailyData[date].openRate = (dailyData[date].openRate + openRate) / 2 || openRate;
          }
          if (clickRate > 0) {
            dailyData[date].clickRate = (dailyData[date].clickRate + clickRate) / 2 || clickRate;
          }
        }

        for (const [date, data] of Object.entries(dailyData)) {
          await supabase.from("platform_metrics").upsert({
            client_id: clientId,
            platform: "newsletter",
            metric_date: date,
            views: data.delivered,
            open_rate: data.openRate,
            click_rate: data.clickRate,
            metadata: {
              delivered: data.delivered,
              opens: data.opens,
              clicks: data.clicks,
              unsubscribes: data.unsubscribes,
              spamReports: data.spamReports,
            }
          }, { onConflict: "client_id,platform,metric_date" });

          count++;
        }
      } else if (csvType === "subscribers") {
        // Process subscriber acquisitions - aggregate by date
        const dateIdx = headers.findIndex(h => h.toLowerCase().includes("created at"));
        const sourceIdx = headers.findIndex(h => h.toLowerCase().includes("acquisition source"));
        const countIdx = headers.findIndex(h => h.toLowerCase() === "count");

        const dailySubs: Record<string, { total: number; sources: Record<string, number> }> = {};

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const date = parseBeehiivDate(values[dateIdx]);
          
          if (!date) continue;

          const source = values[sourceIdx]?.replace(/['"]/g, "").trim() || "unknown";
          const subCount = parseNumber(values[countIdx]);

          if (!dailySubs[date]) {
            dailySubs[date] = { total: 0, sources: {} };
          }
          
          dailySubs[date].total += subCount;
          dailySubs[date].sources[source] = (dailySubs[date].sources[source] || 0) + subCount;
        }

        // Calculate cumulative subscribers
        const sortedDates = Object.keys(dailySubs).sort();
        let cumulativeTotal = 0;

        // Get existing subscriber count to add to
        const { data: existingMetrics } = await supabase
          .from("platform_metrics")
          .select("subscribers")
          .eq("client_id", clientId)
          .eq("platform", "newsletter")
          .order("metric_date", { ascending: false })
          .limit(1);

        const baseSubscribers = existingMetrics?.[0]?.subscribers || 0;

        for (const date of sortedDates) {
          cumulativeTotal += dailySubs[date].total;

          await supabase.from("platform_metrics").upsert({
            client_id: clientId,
            platform: "newsletter",
            metric_date: date,
            subscribers: baseSubscribers > 0 ? null : cumulativeTotal, // Only update if we don't have base
            metadata: {
              newSubscribers: dailySubs[date].total,
              acquisitionSources: dailySubs[date].sources,
            }
          }, { onConflict: "client_id,platform,metric_date" });

          count++;
        }
      }

      const importResult: ImportResult = { success: true, count, type: csvType };
      setResult(importResult);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      localStorage.removeItem(`insights-${clientId}`);

      const typeLabels = {
        daily_performance: "Performance Diária",
        posts: "Posts/Edições",
        subscribers: "Novos Assinantes",
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
