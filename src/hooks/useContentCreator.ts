import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useUnifiedContentGeneration, StructuredContent } from "@/hooks/useUnifiedContentGeneration";
import {
  extractAllReferences,
  getPlatformFromFormat,
  extractTitleFromContent,
} from "@/lib/contentGeneration";

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

export type SourceType = 'theme' | 'url' | 'reference';

export interface ContentSource {
  type: SourceType;
  theme?: string;
  url?: string;
  referenceText?: string;
}

export interface ExtractedSourceData {
  title: string;
  content: string;
  thumbnail?: string;
  images?: string[];
  sourceType: 'youtube' | 'article' | 'html' | 'newsletter' | 'theme' | 'reference';
  videoId?: string;
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
  addedToPlanning?: boolean;
  planningItemId?: string;
  structuredContent?: StructuredContent;
}

export interface PlanningDestination {
  enabled: boolean;
  columnId?: string;
  dueDate?: Date;
}

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

export function useContentCreator() {
  const { toast } = useToast();
  const { workspace } = useWorkspaceContext();
  const { createItem, columns } = usePlanningItems();
  const unified = useUnifiedContentGeneration();

  // Source state
  const [sourceType, setSourceType] = useState<SourceType>('theme');
  const [themeInput, setThemeInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [referenceInput, setReferenceInput] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");

  // Extracted data
  const [extractedData, setExtractedData] = useState<ExtractedSourceData | null>(null);

  // Formats
  const [selectedFormats, setSelectedFormats] = useState<ContentFormat[]>([]);

  // Planning destination
  const [planningDestination, setPlanningDestination] = useState<PlanningDestination>({
    enabled: true,
    columnId: undefined,
    dueDate: undefined,
  });

  // Generation state
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingFormat, setGeneratingFormat] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  // URL detection helper
  const isYoutubeUrl = (url: string): boolean => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  // Extract/prepare source content using unified extraction
  const extractContent = async (): Promise<ExtractedSourceData> => {
    setIsExtracting(true);

    try {
      let data: ExtractedSourceData;

      if (sourceType === 'url') {
        if (!urlInput.trim()) throw new Error("URL é obrigatória");
        const extracted = await extractAllReferences(urlInput);
        
        data = {
          title: 'Conteúdo da URL',
          content: extracted.content,
          thumbnail: extracted.images[0],
          images: extracted.images,
          sourceType: isYoutubeUrl(urlInput) ? 'youtube' : 'article',
        };
      } else if (sourceType === 'reference') {
        if (!referenceInput.trim()) throw new Error("Referência é obrigatória");
        const extracted = await extractAllReferences(referenceInput);
        
        const plainRef = referenceInput
          .replace(/https?:\/\/[^\s]+/g, '')
          .replace(/@\[[^\]]+\]\([^)]+\)/g, '')
          .trim();

        data = {
          title: plainRef || "Conteúdo de Referência",
          content: extracted.content,
          sourceType: 'reference',
          thumbnail: extracted.images[0],
          images: extracted.images,
        };
      } else {
        // Theme
        if (!themeInput.trim()) throw new Error("Tema é obrigatório");
        data = {
          title: themeInput,
          content: themeInput + (additionalContext ? `\n\n${additionalContext}` : ''),
          sourceType: 'theme',
        };
      }

      setExtractedData(data);
      return data;
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

  // Create planning item
  const createPlanningItem = async (
    content: GeneratedContent,
    clientId: string,
    sourceTitle: string
  ): Promise<string | null> => {
    if (!workspace?.id || !planningDestination.enabled) return null;

    try {
      const defaultColumn = columns.find(c => c.column_type === 'draft') || columns[0];
      const columnId = planningDestination.columnId || defaultColumn?.id;

      if (!columnId) {
        console.warn("[ContentCreator] No column found for planning item");
        return null;
      }

      const platform = getPlatformFromFormat(FORMAT_TO_CONTENT_TYPE[content.format]);
      const title = extractTitleFromContent(content.content) || `${sourceTitle} - ${content.format}`;

      const result = await createItem.mutateAsync({
        title,
        content: content.content,
        client_id: clientId,
        column_id: columnId,
        platform: platform as any,
        status: 'draft',
        due_date: planningDestination.dueDate?.toISOString() || null,
        content_type: FORMAT_TO_CONTENT_TYPE[content.format],
      });

      return result?.id || null;
    } catch (error) {
      console.error("[ContentCreator] Failed to create planning item:", error);
      return null;
    }
  };

  // Generate content for a single format using unified generation
  const generateForFormat = async (
    format: ContentFormat, 
    clientId: string,
    sourceData: ExtractedSourceData
  ): Promise<GeneratedContent> => {
    try {
      const contentType = FORMAT_TO_CONTENT_TYPE[format];
      
      // Special handling for cut_moments (different prompt structure)
      if (format === "cut_moments") {
        return await generateCutMoments(clientId, sourceData);
      }

      // Use unified generation
      const result = await unified.generate({
        title: sourceData.title,
        format: contentType,
        clientId,
        additionalContext: additionalContext || undefined,
        images: sourceData.images,
      });

      if (!result) {
        return {
          format,
          content: "",
          objective: "educational" as ContentObjective,
          generatedAt: new Date(),
          error: "Falha na geração",
        };
      }

      return {
        format,
        content: result.content,
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
        structuredContent: result.structuredContent,
      };
    } catch (error) {
      console.error(`[ContentCreator] Error generating ${format}:`, error);
      return {
        format,
        content: "",
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  };

  // Special handling for cut moments (video analysis)
  const generateCutMoments = async (
    clientId: string,
    sourceData: ExtractedSourceData
  ): Promise<GeneratedContent> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Usuário não autenticado");

      const userMessage = `Analise a transcrição abaixo e identifique os 5 MELHORES momentos para criar cortes/clips virais.

TÍTULO DO VÍDEO: ${sourceData.title}

TRANSCRIÇÃO COMPLETA:
${sourceData.content.substring(0, 20000)}

Retorne APENAS o JSON com os 5 momentos, ordenados do maior score para o menor. Use o formato:
{
  "moments": [
    { "timestamp": "0:00", "title": "Título do momento", "description": "Descrição", "score": 95, "hook": "Gancho inicial" }
  ]
}`;

      const { callKaiContentAgent } = await import("@/lib/parseOpenAIStream");
      const finalContent = await callKaiContentAgent({
        clientId,
        request: userMessage,
        format: "cut_moments",
        accessToken,
      });

      let cutMoments: CutMoment[] | undefined;
      if (finalContent) {
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
          console.log("[ContentCreator] Could not parse cut moments:", e);
        }
      }

      return {
        format: "cut_moments",
        content: finalContent,
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
        cutMoments,
      };
    } catch (error) {
      return {
        format: "cut_moments",
        content: "",
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  };

  // Generate all selected formats
  const generateAll = async (clientId: string) => {
    if (selectedFormats.length === 0) {
      throw new Error("Selecione formatos");
    }

    // Prepare source data if not already extracted
    let source = extractedData;
    if (!source) {
      source = await extractContent();
    }

    setIsGenerating(true);
    setGeneratedContents([]);
    setShowResults(true);

    try {
      const results: GeneratedContent[] = [];
      
      for (const format of selectedFormats) {
        setGeneratingFormat(format);
        
        const generatedContent = await generateForFormat(format, clientId, source);
        
        // Add to planning if enabled and content was generated successfully
        if (!generatedContent.error && planningDestination.enabled) {
          const planningItemId = await createPlanningItem(generatedContent, clientId, source.title);
          if (planningItemId) {
            generatedContent.addedToPlanning = true;
            generatedContent.planningItemId = planningItemId;
          }
        }

        results.push(generatedContent);
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
    setSourceType('theme');
    setThemeInput("");
    setUrlInput("");
    setReferenceInput("");
    setAdditionalContext("");
    setExtractedData(null);
    setSelectedFormats([]);
    setGeneratedContents([]);
    setShowResults(false);
    setPlanningDestination({ enabled: true, columnId: undefined, dueDate: undefined });
  };

  const goBackToForm = () => {
    setShowResults(false);
  };

  return {
    // Source
    sourceType,
    setSourceType,
    themeInput,
    setThemeInput,
    urlInput,
    setUrlInput,
    referenceInput,
    setReferenceInput,
    additionalContext,
    setAdditionalContext,
    extractedData,

    // Formats
    selectedFormats,
    toggleFormat,

    // Planning destination
    planningDestination,
    setPlanningDestination,
    columns,

    // Generation
    generatedContents,
    isExtracting,
    isGenerating,
    generatingFormat,
    showResults,

    // Actions
    extractContent,
    generateAll,
    copyToClipboard,
    reset,
    goBackToForm,
  };
}
