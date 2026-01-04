import { useState, useCallback } from "react";
import { CSVAnalysisResult, MetricsPlatform } from "@/types/kaiActions";

interface UseKAICSVAnalysisReturn {
  analyzeCSV: (file: File) => Promise<CSVAnalysisResult>;
  isAnalyzing: boolean;
  result: CSVAnalysisResult | null;
  error: string | null;
}

/**
 * Hook for analyzing CSV files to detect platform and extract metrics
 */
export function useKAICSVAnalysis(): UseKAICSVAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CSVAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeCSV = useCallback(async (file: File): Promise<CSVAnalysisResult> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const content = await readFileAsText(file);
      const lines = content.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        throw new Error("Arquivo CSV vazio ou sem dados");
      }

      const headers = parseCSVLine(lines[0]);
      const platform = detectPlatform(headers, file.name);
      const sampleRows = lines.slice(1, 6).map((line) => parseCSVLine(line));
      const sampleData = sampleRows.map((row) => 
        headers.reduce((acc, header, idx) => {
          acc[header] = row[idx] || "";
          return acc;
        }, {} as Record<string, string>)
      );

      const dateRange = extractDateRange(sampleData, headers);
      const metricsDetected = detectMetrics(headers, platform);

      const analysisResult: CSVAnalysisResult = {
        platform: platform.type,
        confidence: platform.confidence,
        preview: {
          totalRows: lines.length - 1,
          dateRange,
          columns: headers,
          sampleData,
          metricsDetected,
        },
      };

      setResult(analysisResult);
      return analysisResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao analisar CSV";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analyzeCSV,
    isAnalyzing,
    result,
    error,
  };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file);
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

interface PlatformDetection {
  type: MetricsPlatform;
  confidence: number;
}

function detectPlatform(headers: string[], fileName: string): PlatformDetection {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const lowerFileName = fileName.toLowerCase();

  // Instagram patterns
  const instagramPatterns = [
    "impressions", "reach", "engagement", "likes", "comments", 
    "saves", "shares", "profile_visits", "follows",
    "impressões", "alcance", "curtidas", "comentários", "salvos"
  ];
  
  // YouTube patterns
  const youtubePatterns = [
    "views", "watch_time", "subscribers", "likes", "dislikes",
    "visualizações", "tempo_de_exibição", "inscritos",
    "average_view_duration", "ctr", "click_through_rate"
  ];

  // Newsletter patterns
  const newsletterPatterns = [
    "opens", "clicks", "subscribers", "unsubscribes", "bounce_rate",
    "open_rate", "click_rate", "delivered", "sent",
    "aberturas", "cliques", "assinantes"
  ];

  // Twitter patterns
  const twitterPatterns = [
    "retweets", "tweets", "impressions", "engagements",
    "replies", "quote_tweets", "followers"
  ];

  // LinkedIn patterns
  const linkedinPatterns = [
    "impressions", "clicks", "reactions", "comments", "shares",
    "followers", "engagement_rate", "unique_impressions"
  ];

  // Check filename first
  if (lowerFileName.includes("instagram") || lowerFileName.includes("insta")) {
    return { type: "instagram", confidence: 0.9 };
  }
  if (lowerFileName.includes("youtube") || lowerFileName.includes("yt")) {
    return { type: "youtube", confidence: 0.9 };
  }
  if (lowerFileName.includes("newsletter") || lowerFileName.includes("beehiiv") || lowerFileName.includes("mailchimp")) {
    return { type: "newsletter", confidence: 0.9 };
  }
  if (lowerFileName.includes("twitter") || lowerFileName.includes("x_")) {
    return { type: "twitter", confidence: 0.9 };
  }
  if (lowerFileName.includes("linkedin")) {
    return { type: "linkedin", confidence: 0.9 };
  }

  // Check headers
  const instagramScore = countMatches(lowerHeaders, instagramPatterns);
  const youtubeScore = countMatches(lowerHeaders, youtubePatterns);
  const newsletterScore = countMatches(lowerHeaders, newsletterPatterns);
  const twitterScore = countMatches(lowerHeaders, twitterPatterns);
  const linkedinScore = countMatches(lowerHeaders, linkedinPatterns);

  const scores: { type: MetricsPlatform; score: number }[] = [
    { type: "instagram", score: instagramScore },
    { type: "youtube", score: youtubeScore },
    { type: "newsletter", score: newsletterScore },
    { type: "twitter", score: twitterScore },
    { type: "linkedin", score: linkedinScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (best.score === 0) {
    return { type: "unknown", confidence: 0.3 };
  }

  const confidence = Math.min(0.5 + best.score * 0.1, 0.95);
  return { type: best.type, confidence };
}

function countMatches(headers: string[], patterns: string[]): number {
  return headers.reduce((count, header) => {
    for (const pattern of patterns) {
      if (header.includes(pattern)) {
        return count + 1;
      }
    }
    return count;
  }, 0);
}

function extractDateRange(
  data: Record<string, string>[],
  headers: string[]
): { start: string; end: string } | undefined {
  const dateColumns = headers.filter((h) => {
    const lower = h.toLowerCase();
    return lower.includes("date") || lower.includes("data") || 
           lower.includes("day") || lower.includes("dia");
  });

  if (dateColumns.length === 0 || data.length === 0) return undefined;

  const dateColumn = dateColumns[0];
  const dates = data.map((row) => row[dateColumn]).filter(Boolean);

  if (dates.length === 0) return undefined;

  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

function detectMetrics(headers: string[], platform: PlatformDetection): string[] {
  const metricKeywords: Record<MetricsPlatform, string[]> = {
    instagram: ["impressions", "reach", "likes", "comments", "saves", "shares", "engagement", "followers"],
    youtube: ["views", "watch_time", "subscribers", "likes", "comments", "ctr", "average_view_duration"],
    newsletter: ["opens", "clicks", "subscribers", "open_rate", "click_rate", "delivered"],
    twitter: ["impressions", "engagements", "retweets", "replies", "likes", "followers"],
    linkedin: ["impressions", "clicks", "reactions", "comments", "shares", "followers"],
    unknown: [],
  };

  const keywords = metricKeywords[platform.type] || [];
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  return keywords.filter((keyword) =>
    lowerHeaders.some((h) => h.includes(keyword))
  );
}
