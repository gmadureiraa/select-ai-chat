import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExtractedData {
  images: string[];
  caption: string;
  imageCount: number;
}

interface ImportResult {
  title: string;
  content: string;
  sourceUrl: string;
  thumbnailUrl: string;
  images: string[];
  caption: string;
}

type ImportStep = "idle" | "extracting" | "transcribing" | "ready" | "error";

export function useInstagramImport() {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>("idle");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("idle");
    setExtractedData(null);
    setTranscription("");
    setResult(null);
    setError(null);
  };

  const importFromUrl = async (url: string) => {
    if (!url.trim()) {
      setError("URL é obrigatória");
      return;
    }

    try {
      setStep("extracting");
      setError(null);

      // Step 1: Extract images from Instagram
      const { data: extractData, error: extractError } = await supabase.functions.invoke(
        "extract-instagram",
        { body: { url } }
      );

      if (extractError) throw new Error(extractError.message);
      if (extractData.error) throw new Error(extractData.error);

      const extracted: ExtractedData = {
        images: extractData.images || [],
        caption: extractData.caption || "",
        imageCount: extractData.imageCount || 0,
      };
      setExtractedData(extracted);

      if (extracted.images.length === 0) {
        throw new Error("Nenhuma imagem encontrada no post");
      }

      // Step 2: Transcribe images
      setStep("transcribing");

      const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke(
        "transcribe-images",
        { body: { imageUrls: extracted.images } }
      );

      if (transcribeError) throw new Error(transcribeError.message);
      if (transcribeData.error) throw new Error(transcribeData.error);

      const imageTranscription = transcribeData.transcription || "";
      setTranscription(imageTranscription);

      // Step 3: Combine and prepare result
      const title = extractTitle(extracted.caption, url);
      const content = formatContent(extracted.caption, imageTranscription);

      const importResult: ImportResult = {
        title,
        content,
        sourceUrl: url,
        thumbnailUrl: extracted.images[0],
        images: extracted.images,
        caption: extracted.caption,
      };

      setResult(importResult);
      setStep("ready");

      toast({
        title: "Importação concluída",
        description: `${extracted.imageCount} imagem(ns) extraída(s) e transcrita(s)`,
      });
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Erro ao importar");
      setStep("error");
      toast({
        title: "Erro na importação",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const updateTranscription = (newTranscription: string) => {
    setTranscription(newTranscription);
    if (result && extractedData) {
      setResult({
        ...result,
        content: formatContent(extractedData.caption, newTranscription),
      });
    }
  };

  return {
    step,
    extractedData,
    transcription,
    result,
    error,
    importFromUrl,
    updateTranscription,
    reset,
  };
}

function extractTitle(caption: string, url: string): string {
  if (!caption) {
    const match = url.match(/\/(p|reel)\/([a-zA-Z0-9_-]+)/);
    return match ? `Post ${match[2]}` : "Post Instagram";
  }
  const firstLine = caption.split("\n")[0];
  return firstLine.length > 60 ? firstLine.substring(0, 57) + "..." : firstLine;
}

function formatContent(caption: string, transcription: string): string {
  let content = "";

  if (caption) {
    content += `📝 LEGENDA ORIGINAL:\n${caption}\n\n`;
  }

  if (transcription) {
    content += `🖼️ TRANSCRIÇÃO DAS IMAGENS:\n${transcription}`;
  }

  return content.trim();
}
