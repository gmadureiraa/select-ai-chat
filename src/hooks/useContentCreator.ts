import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseMentions } from "@/lib/mentionParser";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

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
  referenceText?: string; // Text with @mentions
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

const FORMAT_TO_PLATFORM: Record<ContentFormat, string | undefined> = {
  newsletter: "newsletter",
  thread: "twitter",
  tweet: "twitter",
  carousel: "instagram",
  linkedin_post: "linkedin",
  instagram_post: "instagram",
  reels_script: "tiktok",
  blog_post: "blog",
  email_marketing: "newsletter",
  cut_moments: undefined,
};

export function useContentCreator() {
  const { toast } = useToast();
  const { workspace } = useWorkspaceContext();
  const { createItem, columns } = usePlanningItems();

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

  // Fetch content from URL
  const fetchUrlContent = async (url: string): Promise<ExtractedSourceData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
        body: { url },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Não foi possível extrair o conteúdo");

      return {
        title: data.title || 'Conteúdo',
        content: data.content || '',
        thumbnail: data.thumbnail,
        images: data.images || [],
        sourceType: data.type || (isYoutubeUrl(url) ? 'youtube' : 'article'),
        videoId: data.videoId,
      };
    } catch (error) {
      console.error("[ContentCreator] URL fetch failed:", error);
      throw error;
    }
  };

  // Fetch content from @mentions
  const fetchMentionedContent = async (text: string): Promise<string> => {
    const mentions = parseMentions(text);
    if (mentions.length === 0) return "";

    const contents: string[] = [];

    for (const mention of mentions) {
      const table = mention.type === 'content' 
        ? 'client_content_library' 
        : 'client_reference_library';

      const { data } = await supabase
        .from(table)
        .select('title, content')
        .eq('id', mention.id)
        .single();

      if (data?.content) {
        contents.push(`**${data.title}:**\n${data.content}`);
      }
    }

    return contents.join('\n\n---\n\n');
  };

  // Extract/prepare source content
  const extractContent = async (): Promise<ExtractedSourceData> => {
    setIsExtracting(true);

    try {
      let data: ExtractedSourceData;

      if (sourceType === 'url') {
        if (!urlInput.trim()) throw new Error("URL é obrigatória");
        const extracted = await fetchUrlContent(urlInput);
        if (!extracted) throw new Error("Não foi possível extrair o conteúdo");
        data = extracted;
      } else if (sourceType === 'reference') {
        if (!referenceInput.trim()) throw new Error("Referência é obrigatória");
        const mentionContent = await fetchMentionedContent(referenceInput);
        
        // Also check for URLs in the reference input
        const urlMatches = referenceInput.match(/https?:\/\/[^\s]+/g) || [];
        let urlContent = "";
        let images: string[] = [];
        let thumbnail: string | undefined;

        for (const url of urlMatches) {
          const fetched = await fetchUrlContent(url);
          if (fetched) {
            urlContent += `\n\n---\n\n${fetched.content}`;
            if (fetched.thumbnail) thumbnail = fetched.thumbnail;
            if (fetched.images) images.push(...fetched.images);
          }
        }

        const plainRef = referenceInput
          .replace(/https?:\/\/[^\s]+/g, '')
          .replace(/@\[[^\]]+\]\([^)]+\)/g, '')
          .trim();

        data = {
          title: plainRef || "Conteúdo de Referência",
          content: mentionContent + urlContent,
          sourceType: 'reference',
          thumbnail,
          images,
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

  // Extract title from content
  const extractTitle = (content: string): string => {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      if (firstLine.length <= 100) return firstLine;
      return firstLine.substring(0, 97) + "...";
    }
    return "Novo conteúdo";
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

      const platform = FORMAT_TO_PLATFORM[content.format];
      const title = extractTitle(content.content) || `${sourceTitle} - ${content.format}`;

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

  // Generate content for a single format
  const generateForFormat = async (
    format: ContentFormat, 
    clientId: string,
    sourceData: ExtractedSourceData
  ): Promise<GeneratedContent> => {
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

      const isVideo = sourceData.sourceType === 'youtube';
      const sourceLabel = isVideo ? 'VÍDEO' : 
                          sourceData.sourceType === 'theme' ? 'TEMA' : 
                          sourceData.sourceType === 'reference' ? 'REFERÊNCIA' : 'ARTIGO/TEXTO';
      const contentLabel = isVideo ? 'TRANSCRIÇÃO' : 'CONTEÚDO';
      const contentType = FORMAT_TO_CONTENT_TYPE[format];

      // Build user message
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

TÍTULO/TEMA: ${sourceData.title}

${contentLabel}:
${sourceData.content.substring(0, 15000)}

${additionalContext ? `INSTRUÇÕES ADICIONAIS: ${additionalContext}` : ''}

Siga as regras do formato e gere o conteúdo pronto para publicar.`;

      // Call multi-agent pipeline
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
      if (!reader) throw new Error("Não foi possível ler a resposta");

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
              if (parsed.step === "complete" && parsed.status === "done" && parsed.content) {
                finalContent = parsed.content;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Parse cut moments if needed
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
          console.log("[ContentCreator] Could not parse cut moments:", e);
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
