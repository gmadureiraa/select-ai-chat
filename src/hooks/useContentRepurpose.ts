import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ContentFormat = 
  | "newsletter" 
  | "thread" 
  | "tweet" 
  | "carousel" 
  | "linkedin_post" 
  | "instagram_post" 
  | "reels_script" 
  | "blog_post" 
  | "email_marketing"
  | "cut_moments";

export type ContentObjective = 
  | "sales" 
  | "lead_generation" 
  | "educational" 
  | "brand_awareness";

export interface SourceData {
  title: string;
  content: string;
  thumbnail?: string;
  images?: string[];
  type: 'youtube' | 'article' | 'html' | 'newsletter';
  videoId?: string;
  metadata?: {
    duration?: number;
    language?: string;
  };
}

export interface CutMoment {
  timestamp: string;
  title: string;
  description: string;
  score: number;
  hook: string;
}

export interface GeneratedContent {
  format: ContentFormat;
  content: string;
  objective: ContentObjective;
  generatedAt: Date;
  cutMoments?: CutMoment[];
  error?: string;
}

// Map ContentFormat to contentType for multi-agent
const FORMAT_TO_CONTENT_TYPE: Record<ContentFormat, string> = {
  newsletter: "newsletter",
  thread: "thread",
  tweet: "tweet",
  carousel: "carousel",
  linkedin_post: "linkedin_post",
  instagram_post: "instagram_post",
  reels_script: "short_video",
  blog_post: "blog_post",
  email_marketing: "email_marketing",
  cut_moments: "cut_moments",
};

export function useContentRepurpose() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<ContentFormat[]>([]);
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingFormat, setGeneratingFormat] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const isYoutubeUrl = (url: string): boolean => {
    return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('ytimg.com');
  };

  const extractContent = async () => {
    if (!sourceUrl.trim()) {
      throw new Error("URL é obrigatória");
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
        body: { url: sourceUrl },
      });

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || "Não foi possível extrair o conteúdo");
      }

      const extractedData: SourceData = {
        title: data.title || 'Conteúdo',
        content: data.content || '',
        thumbnail: data.thumbnail,
        images: data.images || [],
        type: data.type || (isYoutubeUrl(sourceUrl) ? 'youtube' : 'article'),
        videoId: data.videoId,
        metadata: data.metadata,
      };

      setSourceData(extractedData);
      return extractedData;
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleFormat = (format: ContentFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  const generateForFormat = async (format: ContentFormat, clientId: string): Promise<GeneratedContent> => {
    if (!sourceData) {
      throw new Error("Conteúdo de origem é obrigatório");
    }

    try {
      // Fetch client context
      const { data: client } = await supabase
        .from("clients")
        .select("name, identity_guide, description")
        .eq("id", clientId)
        .single();

      // Fetch content library
      const { data: contentLibrary } = await supabase
        .from("client_content_library")
        .select("id, title, content, content_type")
        .eq("client_id", clientId)
        .limit(20);

      // Fetch reference library
      const { data: referenceLibrary } = await supabase
        .from("client_reference_library")
        .select("id, title, content, reference_type")
        .eq("client_id", clientId)
        .limit(10);

      const isVideo = sourceData.type === 'youtube';
      const sourceLabel = isVideo ? 'VÍDEO' : 'ARTIGO/TEXTO';
      const contentLabel = isVideo ? 'TRANSCRIÇÃO' : 'CONTEÚDO';
      const contentType = FORMAT_TO_CONTENT_TYPE[format];

      // Build user message with content and context
      const userMessage = format === "cut_moments" 
        ? `Analise a transcrição abaixo e identifique os 5 MELHORES momentos para criar cortes/clips virais.

TÍTULO DO ${sourceLabel}: ${sourceData.title}

${contentLabel} COMPLETO:
${sourceData.content.substring(0, 20000)}

Retorne APENAS o JSON com os 5 momentos, ordenados do maior score para o menor. Use o formato:
{
  "moments": [
    { "timestamp": "0:00", "title": "Título do momento", "description": "Descrição", "score": 95, "hook": "Gancho inicial" }
  ]
}`
        : `Crie um conteúdo de ${format.replace(/_/g, " ")} baseado no conteúdo abaixo.

TÍTULO DO ${sourceLabel}: ${sourceData.title}

${contentLabel}:
${sourceData.content.substring(0, 15000)}

Siga as regras do formato e gere o conteúdo pronto para publicar.`;

      // Call multi-agent pipeline via fetch for streaming
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-multi-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            userMessage,
            contentLibrary: contentLibrary || [],
            referenceLibrary: referenceLibrary || [],
            identityGuide: client?.identity_guide || "",
            clientName: client?.name || "Cliente",
            contentType,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API: ${response.status} - ${errorText}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Não foi possível ler a resposta");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              // Capture final content when pipeline completes
              if (parsed.step === "complete" && parsed.status === "done" && parsed.content) {
                finalContent = parsed.content;
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      // Parse cut moments if this is the cut_moments format
      let cutMoments: CutMoment[] | undefined;
      if (format === "cut_moments" && finalContent) {
        try {
          const jsonMatch = finalContent.match(/\{[\s\S]*"moments"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            cutMoments = parsed.moments
              .map((m: any) => ({
                timestamp: m.timestamp || "0:00",
                title: m.title || "Momento",
                description: m.description || "",
                score: typeof m.score === 'number' ? m.score : 50,
                hook: m.hook || "",
              }))
              .sort((a: CutMoment, b: CutMoment) => b.score - a.score);
          }
        } catch (e) {
          console.log("Could not parse cut moments JSON:", e);
        }
      }

      return {
        format,
        content: finalContent,
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
        cutMoments,
      };
    } catch (error) {
      console.error(`Error generating ${format}:`, error);
      return {
        format,
        content: "",
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  };

  const generateAll = async (clientId: string) => {
    if (selectedFormats.length === 0) {
      throw new Error("Selecione formatos");
    }

    setIsGenerating(true);
    setGeneratedContents([]);
    setShowResults(true);

    try {
      const results: GeneratedContent[] = [];
      
      for (const format of selectedFormats) {
        setGeneratingFormat(format);
        
        const generatedContent = await generateForFormat(format, clientId);
        results.push(generatedContent);
        
        // Update state progressively
        setGeneratedContents([...results]);
      }

      return results;
    } finally {
      setIsGenerating(false);
      setGeneratingFormat(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const reset = () => {
    setSourceUrl("");
    setSourceData(null);
    setSelectedFormats([]);
    setGeneratedContents([]);
    setShowResults(false);
  };

  const goBackToForm = () => {
    setShowResults(false);
  };

  return {
    sourceUrl,
    setSourceUrl,
    sourceData,
    selectedFormats,
    toggleFormat,
    generatedContents,
    isExtracting,
    isGenerating,
    generatingFormat,
    showResults,
    extractContent,
    generateForFormat,
    generateAll,
    copyToClipboard,
    reset,
    goBackToForm,
  };
}
