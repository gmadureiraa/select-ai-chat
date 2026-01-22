import { callKaiContentAgent } from "@/lib/parseOpenAIStream";
import { normalizeCanvasFormat, toKaiContentAgentFormat } from "./canvasFormats";

export async function generateCanvasText(params: {
  clientId: string;
  accessToken: string;
  request: string;
  format?: string;
  platform?: string;
  onChunk?: (chunkIndex: number) => void;
}): Promise<string> {
  const { clientId, accessToken, request, format, platform, onChunk } = params;

  const normalized = normalizeCanvasFormat(format);
  return callKaiContentAgent({
    clientId,
    request,
    format: toKaiContentAgentFormat(normalized),
    platform,
    accessToken,
    onChunk,
  });
}

