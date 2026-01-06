import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseMentions } from "@/lib/mentionParser";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { ContentFormat, GeneratedContent, ContentObjective } from "./useContentCreator";

export interface FormatQuantity {
  format: ContentFormat;
  quantity: number;
}

export interface BulkAttachment {
  type: 'image' | 'video' | 'url' | 'library';
  value: string;
  name?: string;
}

export interface BulkContentItem extends GeneratedContent {
  id: string;
  index: number;
  status: 'pending' | 'generating' | 'done' | 'error';
}

type FormatComplexity = 'fast' | 'standard' | 'full';

const FORMAT_COMPLEXITY: Record<ContentFormat, FormatComplexity> = {
  tweet: 'fast',
  instagram_post: 'fast',
  thread: 'standard',
  linkedin_post: 'standard',
  reels_script: 'standard',
  email_marketing: 'standard',
  carousel: 'full',
  newsletter: 'full',
  blog_post: 'full',
  cut_moments: 'full',
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

// Estimated time per format in seconds
const FORMAT_TIME_ESTIMATE: Record<ContentFormat, number> = {
  tweet: 8,
  instagram_post: 10,
  thread: 15,
  linkedin_post: 12,
  reels_script: 15,
  email_marketing: 15,
  carousel: 25,
  newsletter: 25,
  blog_post: 30,
  cut_moments: 20,
};

export function useBulkContentCreator() {
  const { toast } = useToast();
  const { workspace } = useWorkspaceContext();
  const { createItem, columns } = usePlanningItems();

  // Input state
  const [briefing, setBriefing] = useState("");
  const [attachments, setAttachments] = useState<BulkAttachment[]>([]);
  const [formatQuantities, setFormatQuantities] = useState<FormatQuantity[]>([]);

  // Planning destination
  const [autoAddToPlanning, setAutoAddToPlanning] = useState(true);
  const [targetColumnId, setTargetColumnId] = useState<string | undefined>();

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<BulkContentItem[]>([]);
  const [researchContext, setResearchContext] = useState<string>("");

  // Calculate total items and time estimate
  const totalItems = formatQuantities.reduce((sum, fq) => sum + fq.quantity, 0);
  const timeEstimate = formatQuantities.reduce((sum, fq) => {
    return sum + (FORMAT_TIME_ESTIMATE[fq.format] || 15) * fq.quantity;
  }, 0);

  // Update quantity for a format
  const updateQuantity = useCallback((format: ContentFormat, quantity: number) => {
    setFormatQuantities(prev => {
      const existing = prev.find(fq => fq.format === format);
      if (quantity === 0) {
        return prev.filter(fq => fq.format !== format);
      }
      if (existing) {
        return prev.map(fq => fq.format === format ? { ...fq, quantity } : fq);
      }
      return [...prev, { format, quantity }];
    });
  }, []);

  // Add attachment
  const addAttachment = useCallback((attachment: BulkAttachment) => {
    setAttachments(prev => [...prev, attachment]);
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Fetch library content from @mentions
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

  // Fetch URL content
  const fetchUrlContent = async (url: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
        body: { url },
      });
      if (error) throw error;
      return data?.content || "";
    } catch {
      return "";
    }
  };

  // Create planning item
  const createPlanningItem = async (
    content: GeneratedContent,
    clientId: string,
    title: string
  ): Promise<string | null> => {
    if (!workspace?.id || !autoAddToPlanning) return null;

    try {
      const defaultColumn = columns.find(c => c.column_type === 'draft') || columns[0];
      const columnId = targetColumnId || defaultColumn?.id;

      if (!columnId) return null;

      const platform = FORMAT_TO_PLATFORM[content.format];
      
      const result = await createItem.mutateAsync({
        title: title.substring(0, 100),
        content: content.content,
        client_id: clientId,
        column_id: columnId,
        platform: platform as any,
        status: 'draft',
        content_type: FORMAT_TO_CONTENT_TYPE[content.format],
      });

      return result?.id || null;
    } catch (error) {
      console.error("[BulkCreator] Failed to create planning item:", error);
      return null;
    }
  };

  // Generate single content item
  const generateSingleContent = async (
    format: ContentFormat,
    index: number,
    clientId: string,
    context: string,
    clientData: any
  ): Promise<GeneratedContent> => {
    try {
      const contentType = FORMAT_TO_CONTENT_TYPE[format];
      const userMessage = `Crie um conteúdo de ${format.replace(/_/g, " ")} (item ${index + 1}) baseado no contexto abaixo.

BRIEFING E CONTEXTO:
${context}

Siga as regras do formato e gere o conteúdo pronto para publicar. Seja criativo e único - não repita ideias já geradas.`;

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
            contentLibrary: [],
            referenceLibrary: [],
            identityGuide: clientData?.identity_guide || "",
            clientName: clientData?.name || "Cliente",
            contentType,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

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

      return {
        format,
        content: finalContent,
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error(`[BulkCreator] Error generating ${format}:`, error);
      return {
        format,
        content: "",
        objective: "educational" as ContentObjective,
        generatedAt: new Date(),
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  };

  // Main generate function with parallelization
  const generateAll = async (clientId: string) => {
    if (formatQuantities.length === 0 || !briefing.trim()) {
      throw new Error("Preencha o briefing e selecione formatos");
    }

    setIsGenerating(true);
    
    // Build items list
    const items: BulkContentItem[] = [];
    let itemIndex = 0;
    for (const fq of formatQuantities) {
      for (let i = 0; i < fq.quantity; i++) {
        items.push({
          id: `${fq.format}-${i}-${Date.now()}`,
          index: itemIndex++,
          format: fq.format,
          content: "",
          objective: "educational",
          generatedAt: new Date(),
          status: 'pending',
        });
      }
    }
    setGeneratedItems(items);

    try {
      // Phase 1: Centralized Research
      let context = briefing;

      // Fetch URL content from attachments
      for (const att of attachments) {
        if (att.type === 'url') {
          const urlContent = await fetchUrlContent(att.value);
          if (urlContent) {
            context += `\n\n---\nCONTEÚDO DE ${att.value}:\n${urlContent}`;
          }
        } else if (att.type === 'library') {
          const libContent = await fetchMentionedContent(att.value);
          if (libContent) {
            context += `\n\n---\n${libContent}`;
          }
        }
      }
      
      // Also parse @mentions in briefing
      const mentionContent = await fetchMentionedContent(briefing);
      if (mentionContent) {
        context += `\n\n---\n${mentionContent}`;
      }

      setResearchContext(context);

      // Fetch client data
      const { data: clientData } = await supabase
        .from("clients")
        .select("name, identity_guide, description")
        .eq("id", clientId)
        .single();

      // Phase 2: Parallel Generation by Complexity Group
      const grouped: Record<FormatComplexity, BulkContentItem[]> = {
        fast: [],
        standard: [],
        full: [],
      };

      for (const item of items) {
        const complexity = FORMAT_COMPLEXITY[item.format];
        grouped[complexity].push(item);
      }

      // Process with concurrency limit
      const CONCURRENCY_LIMIT = 3;
      
      const processItem = async (item: BulkContentItem) => {
        // Update status to generating
        setGeneratedItems(prev => 
          prev.map(i => i.id === item.id ? { ...i, status: 'generating' } : i)
        );

        const result = await generateSingleContent(
          item.format,
          item.index,
          clientId,
          context,
          clientData
        );

        // Create planning item if enabled
        let planningItemId: string | null = null;
        if (!result.error && autoAddToPlanning) {
          const title = result.content.split('\n')[0]?.substring(0, 80) || `${item.format} #${item.index + 1}`;
          planningItemId = await createPlanningItem(result, clientId, title);
        }

        // Update item with result
        const updatedItem: BulkContentItem = {
          ...item,
          ...result,
          status: result.error ? 'error' : 'done',
          addedToPlanning: !!planningItemId,
          planningItemId: planningItemId || undefined,
        };

        setGeneratedItems(prev => 
          prev.map(i => i.id === item.id ? updatedItem : i)
        );

        return updatedItem;
      };

      // Process items in batches with concurrency
      const allItems = [...grouped.fast, ...grouped.standard, ...grouped.full];
      
      for (let i = 0; i < allItems.length; i += CONCURRENCY_LIMIT) {
        const batch = allItems.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(processItem));
      }

      toast({
        title: "Conteúdos gerados!",
        description: `${items.length} conteúdos criados com sucesso`,
      });

    } catch (error) {
      toast({
        title: "Erro ao gerar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Send single item to planning
  const sendToPlanning = async (itemId: string, clientId: string) => {
    const item = generatedItems.find(i => i.id === itemId);
    if (!item || item.addedToPlanning) return;

    const title = item.content.split('\n')[0]?.substring(0, 80) || `${item.format}`;
    const planningItemId = await createPlanningItem(item, clientId, title);

    if (planningItemId) {
      setGeneratedItems(prev =>
        prev.map(i => i.id === itemId ? { 
          ...i, 
          addedToPlanning: true, 
          planningItemId 
        } : i)
      );
      toast({ title: "Adicionado ao planejamento!" });
    }
  };

  // Discard item
  const discardItem = useCallback((itemId: string) => {
    setGeneratedItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  // Reset everything
  const reset = useCallback(() => {
    setBriefing("");
    setAttachments([]);
    setFormatQuantities([]);
    setGeneratedItems([]);
    setResearchContext("");
    setIsGenerating(false);
  }, []);

  return {
    // Input state
    briefing,
    setBriefing,
    attachments,
    addAttachment,
    removeAttachment,
    formatQuantities,
    updateQuantity,
    
    // Planning
    autoAddToPlanning,
    setAutoAddToPlanning,
    targetColumnId,
    setTargetColumnId,
    columns,

    // Computed
    totalItems,
    timeEstimate,

    // Generation
    isGenerating,
    generatedItems,
    generateAll,
    sendToPlanning,
    discardItem,
    reset,
  };
}
