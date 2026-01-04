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

export interface TranscriptData {
  title: string;
  content: string;
  thumbnail: string;
  videoId: string;
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

// Map ContentFormat to execute-agent contentType
const FORMAT_TO_AGENT: Record<ContentFormat, string> = {
  newsletter: "newsletter_agent",
  thread: "thread_agent",
  tweet: "tweet_agent",
  carousel: "carousel_agent",
  linkedin_post: "linkedin_agent",
  instagram_post: "static_post_agent",
  reels_script: "reels_agent",
  blog_post: "blog_agent",
  email_marketing: "email_marketing_agent",
  cut_moments: "cut_moments_agent",
};

const OBJECTIVE_CONTEXT: Record<ContentObjective, string> = {
  sales: "Foco em conversão e vendas. Destaque benefícios, resolução de problemas e urgência. Use CTAs de compra/contratação.",
  lead_generation: "Foco em captura de leads. Ofereça valor em troca de contato. Use CTAs para baixar materiais, inscrever-se, agendar reunião.",
  educational: "Foco em ensinar e informar. Estruture de forma didática. Use exemplos e analogias. Posicione como autoridade no assunto.",
  brand_awareness: "Foco em construir reconhecimento e autoridade. Conte histórias. Mostre valores e propósito. Crie conexão emocional.",
};

export function useContentRepurpose(clientId: string) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<ContentFormat[]>([]);
  const [contentObjective, setContentObjective] = useState<ContentObjective | null>(null);
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingFormat, setGeneratingFormat] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const transcribe = async () => {
    if (!youtubeUrl.trim()) {
      throw new Error("URL do YouTube é obrigatória");
    }

    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-youtube", {
        body: { url: youtubeUrl },
      });

      if (error) throw error;
      if (!data || !data.content) {
        throw new Error("Não foi possível extrair a transcrição do vídeo");
      }

      setTranscript({
        title: data.title,
        content: data.content,
        thumbnail: data.thumbnail,
        videoId: data.videoId,
        metadata: data.metadata,
      });

      return data;
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleFormat = (format: ContentFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  const generateForFormat = async (format: ContentFormat): Promise<GeneratedContent> => {
    if (!transcript || !contentObjective) {
      throw new Error("Transcrição e objetivo são obrigatórios");
    }

    const agentType = "content_writer";
    const contentType = FORMAT_TO_AGENT[format];
    const objectiveContext = OBJECTIVE_CONTEXT[contentObjective];

    // Build user message with transcript and context
    const userMessage = format === "cut_moments" 
      ? `Analise a transcrição abaixo e identifique os 5 MELHORES momentos para criar cortes/clips virais.

OBJETIVO DO CONTEÚDO: ${objectiveContext}

TÍTULO DO VÍDEO: ${transcript.title}

TRANSCRIÇÃO COMPLETA:
${transcript.content.substring(0, 20000)}

Retorne APENAS o JSON com os 5 momentos, ordenados do maior score para o menor.`
      : `Crie um conteúdo de ${format.replace("_", " ")} baseado na transcrição do vídeo abaixo.

OBJETIVO DO CONTEÚDO: ${objectiveContext}

TÍTULO DO VÍDEO: ${transcript.title}

TRANSCRIÇÃO:
${transcript.content.substring(0, 15000)}

Siga as regras do formato e gere o conteúdo pronto para publicar.`;

    try {
      const { data, error } = await supabase.functions.invoke("execute-agent", {
        body: {
          agentType,
          contentType,
          userMessage,
          clientId,
          clientContext: {
            name: "Cliente",
            description: "",
          },
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Erro ao gerar conteúdo");
      }

      const content = data.output || "";

      // Parse cut moments if this is the cut_moments format
      let cutMoments: CutMoment[] | undefined;
      if (format === "cut_moments") {
        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*"moments"[\s\S]*\}/);
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
        content,
        objective: contentObjective,
        generatedAt: new Date(),
        cutMoments,
      };
    } catch (error) {
      console.error(`Error generating ${format}:`, error);
      // Return error content instead of throwing
      return {
        format,
        content: "",
        objective: contentObjective,
        generatedAt: new Date(),
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  };

  const generateAll = async () => {
    if (!contentObjective || selectedFormats.length === 0) {
      throw new Error("Selecione objetivo e formatos");
    }

    setIsGenerating(true);
    setGeneratedContents([]);
    // Show results page immediately
    setShowResults(true);

    try {
      const results: GeneratedContent[] = [];
      
      for (const format of selectedFormats) {
        setGeneratingFormat(format);
        
        const generatedContent = await generateForFormat(format);
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
    setYoutubeUrl("");
    setTranscript(null);
    setSelectedFormats([]);
    setContentObjective(null);
    setGeneratedContents([]);
    setShowResults(false);
  };

  const goBackToForm = () => {
    setShowResults(false);
  };

  return {
    youtubeUrl,
    setYoutubeUrl,
    transcript,
    selectedFormats,
    toggleFormat,
    contentObjective,
    setContentObjective,
    generatedContents,
    isTranscribing,
    isGenerating,
    generatingFormat,
    showResults,
    transcribe,
    generateForFormat,
    generateAll,
    copyToClipboard,
    reset,
    goBackToForm,
  };
}
