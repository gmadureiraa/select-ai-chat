import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseMentions } from "@/lib/mentionParser";

interface GenerateContentParams {
  title: string;
  contentType: string;
  clientId: string;
  referenceInput?: string; // Can be URL, @mentions, or plain text
}

interface ReferenceContent {
  title?: string;
  content: string;
  type: 'youtube' | 'article' | 'html' | 'newsletter';
  thumbnail?: string;
  images?: string[];
}

interface GenerateContentResult {
  content: string;
  images: string[];
}

export function usePlanningContentGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingReference, setIsFetchingReference] = useState(false);
  const { toast } = useToast();

  // Fetch content from a reference URL
  const fetchReferenceContent = async (url: string): Promise<ReferenceContent | null> => {
    if (!url) return null;

    try {
      const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
        body: { url }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch reference");

      return {
        title: data.title,
        content: data.content || "",
        type: data.type || "article",
        thumbnail: data.thumbnail,
        images: data.images || []
      };
    } catch (error) {
      console.error("[PlanningContent] Reference fetch failed:", error);
      return null;
    }
  };

  // Fetch content from @mentions in the library
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

  const generateContent = async ({
    title,
    contentType,
    clientId,
    referenceInput
  }: GenerateContentParams): Promise<GenerateContentResult | null> => {
    if (!title || !contentType || !clientId) {
      toast({
        title: "Dados incompletos",
        description: "Preencha título, formato e cliente para gerar conteúdo.",
        variant: "destructive"
      });
      return null;
    }

    setIsGenerating(true);
    setIsFetchingReference(true);

    try {
      let allReferenceContent: string[] = [];
      let extractedImages: string[] = [];

      // 1. Detect and fetch ALL URL content (supports multiple URLs)
      const urlMatches = referenceInput?.match(/https?:\/\/[^\s]+/g) || [];
      if (urlMatches.length > 0) {
        console.log(`[PlanningContent] Found ${urlMatches.length} URLs to fetch`);
        
        // Fetch all URLs in parallel
        const fetchPromises = urlMatches.map(url => fetchReferenceContent(url));
        const fetchedResults = await Promise.all(fetchPromises);
        
        let successCount = 0;
        fetchedResults.forEach((fetched, index) => {
          if (fetched) {
            successCount++;
            const sourceType = fetched.type === 'youtube' ? 'TRANSCRIÇÃO DO VÍDEO' :
                              fetched.type === 'newsletter' ? 'NEWSLETTER' :
                              'ARTIGO DE REFERÊNCIA';
            let refText = `**${sourceType} ${urlMatches.length > 1 ? `#${index + 1}` : ''}:**`;
            if (fetched.title) refText += `\nTítulo: ${fetched.title}`;
            // Limit each source content to allow more sources
            const charLimit = Math.floor(12000 / urlMatches.length);
            refText += `\n\n${fetched.content.substring(0, charLimit)}`;
            allReferenceContent.push(refText);

            // Capture images from reference
            if (fetched.thumbnail && !extractedImages.includes(fetched.thumbnail)) {
              extractedImages.push(fetched.thumbnail);
            }
            if (fetched.images && fetched.images.length > 0) {
              fetched.images.forEach(img => {
                if (!extractedImages.includes(img)) {
                  extractedImages.push(img);
                }
              });
            }
          }
        });

        // Warn user about partial failures
        if (successCount < urlMatches.length) {
          toast({
            title: `Aviso: ${urlMatches.length - successCount} URL(s) não carregada(s)`,
            description: successCount > 0 
              ? `Gerando com ${successCount} fonte(s) disponível(is).`
              : "Não foi possível extrair conteúdo das URLs. Gerando apenas com o título.",
            variant: "default"
          });
        }
      }

      // 2. Fetch @mentioned content
      const mentionContent = await fetchMentionedContent(referenceInput || "");
      if (mentionContent) {
        allReferenceContent.push(`**CONTEÚDO DA BIBLIOTECA:**\n\n${mentionContent}`);
      }

      // 3. Extract remaining plain text (without URL and without mentions)
      const cleanText = (referenceInput || "")
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/@\[[^\]]+\]\([^)]+\)/g, '')
        .trim();

      setIsFetchingReference(false);

      
      // Build prompt
      const prompt = buildPrompt(
        title, 
        cleanText, 
        contentType, 
        allReferenceContent.length > 0 ? allReferenceContent.join('\n\n---\n\n') : undefined
      );

      console.log("[PlanningContent] Generating with content type:", contentType, "hasReference:", allReferenceContent.length > 0);

      // Fetch client data for multi-agent context
      const { data: client } = await supabase
        .from("clients")
        .select("name, identity_guide, description")
        .eq("id", clientId)
        .single();

      // Fetch content library for context
      const { data: contentLibrary } = await supabase
        .from("client_content_library")
        .select("id, title, content, content_type")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch reference library for context
      const { data: referenceLibrary } = await supabase
        .from("client_reference_library")
        .select("id, title, content, reference_type")
        .eq("client_id", clientId)
        .limit(10);

      // Use chat-multi-agent with full pipeline (researcher → writer → editor → reviewer)
      console.log("[PlanningContent] Using multi-agent pipeline for quality content generation");
      
      const { data, error } = await supabase.functions.invoke("chat-multi-agent", {
        body: {
          userMessage: prompt,
          contentLibrary: (contentLibrary || []).map(c => ({
            id: c.id,
            title: c.title,
            content_type: c.content_type,
            content: c.content
          })),
          referenceLibrary: (referenceLibrary || []).map(r => ({
            id: r.id,
            title: r.title,
            reference_type: r.reference_type,
            content: r.content
          })),
          identityGuide: client?.identity_guide || "",
          copywritingGuide: "",
          clientName: client?.name || "Cliente",
          contentType: contentType
        },
      });

      if (error) {
        console.error("[PlanningContent] Multi-agent error:", error);
        throw error;
      }

      // Process streaming response from multi-agent
      let generatedContent = "";
      const reader = data.body?.getReader();
      
      if (!reader) {
        throw new Error("Não foi possível ler a resposta do pipeline");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const { step, status, content: stepContent } = parsed;

            // Capture final content when complete
            if (step === "complete" && status === "done" && stepContent) {
              generatedContent = stepContent;
            } else if (step === "error") {
              throw new Error(stepContent || "Erro no pipeline multi-agente");
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes("pipeline")) throw e;
            // Skip unparseable lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;
          
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.step === "complete" && parsed.status === "done" && parsed.content) {
              generatedContent = parsed.content;
            }
          } catch {
            // Ignore
          }
        }
      }

      console.log("[PlanningContent] Multi-agent generated content length:", generatedContent.length);

      if (generatedContent) {
        const imageCount = extractedImages.length;
        toast({
          title: "Conteúdo gerado!",
          description: imageCount > 0 
            ? `Conteúdo criado com ${imageCount} imagem(s) da referência.`
            : allReferenceContent.length > 0 
              ? "O conteúdo foi criado com base nas referências e contexto do cliente."
              : "O conteúdo foi criado com base no título e contexto do cliente."
        });
        return {
          content: generatedContent,
          images: extractedImages.slice(0, 3) // Limit to 3 images
        };
      }

      toast({
        title: "Sem conteúdo",
        description: "A IA não retornou conteúdo. Tente novamente.",
        variant: "destructive"
      });
      return null;
    } catch (error) {
      console.error("[PlanningContent] Generation failed:", error);
      toast({
        title: "Erro ao gerar conteúdo",
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGenerating(false);
      setIsFetchingReference(false);
    }
  };

  return {
    generateContent,
    isGenerating,
    isFetchingReference
  };
}

// Removed getPlatformFromContentType - no longer needed with multi-agent pipeline

function buildPrompt(
  title: string, 
  additionalDescription: string | undefined, 
  contentType: string,
  referenceContent?: string
): string {
  const contentTypeNames: Record<string, string> = {
    tweet: "tweet para Twitter/X",
    thread: "thread com 5-10 tweets para Twitter/X",
    x_article: "artigo no X",
    linkedin_post: "post para LinkedIn",
    carousel: "carrossel com 8-10 slides para Instagram",
    stories: "sequência de stories para Instagram",
    static_image: "post para Instagram",
    instagram_post: "post para Instagram",
    newsletter: "newsletter completa",
    blog_post: "artigo de blog",
    short_video: "roteiro de vídeo curto (Reels/TikTok)",
    long_video: "roteiro de vídeo longo (YouTube)",
    other: "conteúdo"
  };

  const formatName = contentTypeNames[contentType] || "conteúdo";

  let prompt = `Crie um ${formatName} sobre: "${title}"`;

  if (additionalDescription) {
    prompt += `\n\nInstruções adicionais: ${additionalDescription}`;
  }

  if (referenceContent) {
    prompt += `\n\n---\n\n**MATERIAL DE REFERÊNCIA:**\n\n${referenceContent}`;
    prompt += `\n\n---\n\nUSE o material de referência acima como base principal para criar o conteúdo, extraindo os melhores insights e adaptando para o formato ${formatName}.`;
  }

  prompt += `\n\nIMPORTANTE:
- Siga rigorosamente as regras do formato ${formatName}
- Use o tom de voz e estilo do cliente
- Entregue o conteúdo 100% pronto para publicar
- Seja específico e evite generalidades`;

  return prompt;
}
