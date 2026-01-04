import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { URLAnalysisResult } from "@/types/kaiActions";

interface UseKAIURLAnalysisReturn {
  analyzeURL: (url: string) => Promise<URLAnalysisResult>;
  isAnalyzing: boolean;
  result: URLAnalysisResult | null;
  error: string | null;
}

/**
 * Hook for analyzing URLs (YouTube, articles, newsletters, etc.)
 */
export function useKAIURLAnalysis(): UseKAIURLAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<URLAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeURL = useCallback(async (url: string): Promise<URLAnalysisResult> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const urlType = detectURLType(url);
      let analysisResult: URLAnalysisResult;

      switch (urlType) {
        case "youtube":
          analysisResult = await analyzeYouTubeURL(url);
          break;
        case "article":
        case "newsletter":
        case "social":
          analysisResult = await analyzeGenericURL(url, urlType);
          break;
        default:
          analysisResult = await analyzeGenericURL(url, "unknown");
      }

      setResult(analysisResult);
      return analysisResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao analisar URL";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    analyzeURL,
    isAnalyzing,
    result,
    error,
  };
}

function detectURLType(url: string): URLAnalysisResult["type"] {
  const lowerURL = url.toLowerCase();

  // YouTube
  if (lowerURL.includes("youtube.com") || lowerURL.includes("youtu.be")) {
    return "youtube";
  }

  // Social Media
  if (
    lowerURL.includes("instagram.com") ||
    lowerURL.includes("twitter.com") ||
    lowerURL.includes("x.com") ||
    lowerURL.includes("linkedin.com") ||
    lowerURL.includes("tiktok.com") ||
    lowerURL.includes("facebook.com")
  ) {
    return "social";
  }

  // Newsletter platforms
  if (
    lowerURL.includes("beehiiv.com") ||
    lowerURL.includes("substack.com") ||
    lowerURL.includes("mailchimp.com") ||
    lowerURL.includes("convertkit.com")
  ) {
    return "newsletter";
  }

  // Default to article
  return "article";
}

async function analyzeYouTubeURL(url: string): Promise<URLAnalysisResult> {
  try {
    const { data, error } = await supabase.functions.invoke("extract-youtube", {
      body: { url },
    });

    if (error) throw error;

    return {
      type: "youtube",
      title: data.title || "Vídeo do YouTube",
      description: data.description,
      content: data.transcript,
      thumbnailUrl: data.thumbnailUrl,
      author: data.author,
      publishedAt: data.publishedAt,
      metadata: {
        videoId: data.videoId,
        duration: data.duration,
        viewCount: data.viewCount,
        likeCount: data.likeCount,
      },
    };
  } catch (error) {
    console.error("YouTube extraction error:", error);
    // Return basic info from URL
    const videoId = extractYouTubeId(url);
    return {
      type: "youtube",
      title: "Vídeo do YouTube",
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : undefined,
      metadata: { videoId },
    };
  }
}

async function analyzeGenericURL(
  url: string,
  type: URLAnalysisResult["type"]
): Promise<URLAnalysisResult> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
      body: { url },
    });

    if (error) throw error;

    return {
      type,
      title: data.title || "Conteúdo",
      description: data.description,
      content: data.content,
      thumbnailUrl: data.thumbnailUrl || data.imageUrl,
      author: data.author,
      publishedAt: data.publishedAt,
      metadata: {
        siteName: data.siteName,
        wordCount: data.content?.split(/\s+/).length,
      },
    };
  } catch (error) {
    console.error("URL extraction error:", error);
    return {
      type,
      title: new URL(url).hostname,
      metadata: { url },
    };
  }
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
