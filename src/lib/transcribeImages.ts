import { supabase } from "@/integrations/supabase/client";

type TranscribeImagesChunkedOptions = {
  userId?: string;
  clientId?: string;
  startIndexOffset?: number;
  chunkSize?: number;
};

export async function transcribeImagesChunked(
  imageUrls: string[],
  options: TranscribeImagesChunkedOptions = {}
): Promise<string> {
  const chunkSize = Math.max(1, options.chunkSize ?? 1);
  const startIndexOffset = Math.max(0, options.startIndexOffset ?? 0);

  const chunks: string[] = [];

  for (let i = 0; i < imageUrls.length; i += chunkSize) {
    const chunk = imageUrls.slice(i, i + chunkSize);

    const { data, error } = await supabase.functions.invoke("transcribe-images", {
      body: {
        imageUrls: chunk,
        startIndex: startIndexOffset + i,
        userId: options.userId,
        clientId: options.clientId,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    if (data?.transcription) {
      chunks.push(data.transcription);
    }
  }

  return chunks.join("\n\n").trim();
}
