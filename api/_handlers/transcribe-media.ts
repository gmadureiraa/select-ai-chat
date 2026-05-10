// Migrated from supabase/functions/transcribe-media/index.ts
// Whisper transcription for audio/video. Accepts URL or base64 input.
import { anonPost } from '../_lib/handler.js';
import { queryOne } from '../_lib/db.js';
import { logAIUsage } from '../_lib/shared/ai-usage.js';
import { assertClientAccess } from '../_lib/access.js';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB Whisper cap
const VALID_EXTENSIONS = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];

function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  return Buffer.from(base64Data, 'base64');
}

export default anonPost(async ({ body, user }) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');

  const { url, base64, mimeType, fileName, userId, clientId } = body as {
    url?: string;
    base64?: string;
    mimeType?: string;
    fileName?: string;
    userId?: string;
    clientId?: string;
  };

  if (!url && !base64) throw new Error('URL ou base64 é obrigatório');
  if (user && clientId) await assertClientAccess(user.id, clientId);

  let audioBuffer: Buffer;
  let resolvedContentType: string;
  let audioFileName = fileName || 'media.mp3';

  if (url) {
    console.log('[transcribe-media] downloading:', url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha ao baixar mídia: ${response.status}`);
    const ab = await response.arrayBuffer();
    audioBuffer = Buffer.from(ab);
    resolvedContentType = response.headers.get('content-type') || mimeType || 'audio/mp3';
    const urlPath = new URL(url).pathname;
    const urlFileName = urlPath.split('/').pop();
    if (urlFileName) audioFileName = urlFileName;
  } else {
    audioBuffer = base64ToBuffer(base64!);
    resolvedContentType = mimeType || 'audio/mp3';
    if (resolvedContentType.includes('video')) audioFileName = 'video.mp4';
    else if (resolvedContentType.includes('audio')) audioFileName = 'audio.mp3';
  }

  console.log(`[transcribe-media] size=${audioBuffer.length} fname=${audioFileName}`);

  let decodedFileName = decodeURIComponent(audioFileName);
  let fileExtension = decodedFileName.split('.').pop()?.toLowerCase() || '';
  if (fileExtension === 'opus') {
    decodedFileName = decodedFileName.replace(/\.opus$/i, '.ogg');
    fileExtension = 'ogg';
  }
  audioFileName = decodedFileName;

  if (IMAGE_EXTENSIONS.includes(fileExtension)) {
    console.log('[transcribe-media] skipping image:', audioFileName);
    return {
      text: '',
      duration: 0,
      language: null,
      segments: [],
      skipped: true,
      reason: 'Imagens não podem ser transcritas. Apenas arquivos de áudio/vídeo são suportados.',
    };
  }

  if (audioBuffer.length > MAX_SIZE) {
    const fileSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
    return {
      error: `Arquivo muito grande para transcrição. Máximo: 25MB. Seu arquivo: ${fileSizeMB}MB. Tente comprimir o vídeo ou usar um arquivo menor.`,
      fileTooLarge: true,
      fileSize: audioBuffer.length,
      maxSize: MAX_SIZE,
    };
  }

  const formData = new FormData();
  // Convert Buffer to Blob for FormData (Node 18+/20+)
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: resolvedContentType });
  formData.append('file', blob, audioFileName);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');
  formData.append('response_format', 'verbose_json');

  console.log('[transcribe-media] calling OpenAI Whisper...');
  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });
  if (!whisperResponse.ok) {
    const errorText = await whisperResponse.text();
    console.error('[transcribe-media] Whisper error:', errorText);
    throw new Error(`Erro na transcrição: ${whisperResponse.status}`);
  }
  const result = (await whisperResponse.json()) as any;
  console.log(`[transcribe-media] done, duration=${result.duration}s`);

  // Log AI usage (Whisper billed per second of audio)
  try {
    let resolvedUserId: string | null = userId || null;
    if (!resolvedUserId && clientId) {
      const c = await queryOne<any>(
        `SELECT user_id, created_by, workspace_id FROM clients WHERE id = $1`,
        [clientId],
      ).catch(() => null);
      resolvedUserId = c?.user_id || c?.created_by || null;
      if (!resolvedUserId && c?.workspace_id) {
        const ws = await queryOne<any>(
          `SELECT owner_id FROM workspaces WHERE id = $1`,
          [c.workspace_id],
        ).catch(() => null);
        resolvedUserId = ws?.owner_id || null;
      }
    }
    if (resolvedUserId) {
      const seconds = Math.ceil(result.duration || 0);
      await logAIUsage(resolvedUserId, 'whisper-1', 'transcribe-media', seconds, 0, {
        client_id: clientId,
        duration_seconds: seconds,
        file_name: fileName,
      });
    }
  } catch (e) {
    console.error('[transcribe-media] failed to log usage:', e);
  }

  return {
    text: result.text,
    duration: result.duration,
    language: result.language,
    segments: result.segments || [],
  };
});
