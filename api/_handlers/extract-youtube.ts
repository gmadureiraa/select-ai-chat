// Migrated from supabase/functions/extract-youtube/index.ts
import { authedPost } from '../_lib/handler.js';

function extractVideoId(url: string): string {
  if (url.includes('/@') || url.includes('/channel/') || url.includes('/c/')) {
    throw new Error('Forneça uma URL de vídeo do YouTube, não de canal.');
  }
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  throw new Error('URL do YouTube inválida.');
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const html = await r.text();
  const m = html.match(/var ytInitialPlayerResponse = ({.+?});/);
  if (!m) throw new Error('Player response não encontrado');
  const player = JSON.parse(m[1]);
  const captions = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captions || captions.length === 0) throw new Error('Legendas não disponíveis');
  let track = captions.find((t: any) => t.languageCode === 'pt' || t.languageCode === 'pt-BR') || captions[0];
  const cr = await fetch(track.baseUrl);
  const cxml = await cr.text();
  const parts: string[] = [];
  for (const tm of cxml.matchAll(/<text[^>]*>(.*?)<\/text>/g)) {
    const text = tm[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '');
    if (text.trim()) parts.push(text.trim());
  }
  return parts.join(' ');
}

export default authedPost(async ({ body }) => {
  const { url } = body;
  if (!url) throw new Error('URL do YouTube é obrigatória');
  const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY;
  if (!SUPADATA_API_KEY) throw new Error('SUPADATA_API_KEY não configurada');

  const videoId = extractVideoId(url);
  let title = 'Vídeo do YouTube';
  let content = '';
  let duration: string | number | null = null;

  // Try Supadata
  try {
    const r = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true&lang=pt`,
      { headers: { 'x-api-key': SUPADATA_API_KEY } }
    );
    if (r.ok) {
      const td = await r.json();
      title = td.title || td.video_title || title;
      content = td.content || td.transcript || td.text || '';
      duration = td.duration ?? null;
    }
  } catch (e) {
    console.error('Erro Supadata:', e);
  }

  if (!content) {
    try {
      content = await fetchYouTubeTranscript(videoId);
    } catch (e) {
      console.error('Fallback transcript falhou:', e);
    }
  }

  if (title === 'Vídeo do YouTube') {
    try {
      const oR = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (oR.ok) {
        const od = await oR.json();
        title = od.title || title;
      }
    } catch {}
  }

  const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const hasTranscript = !!(content && content.length > 0);
  return {
    title,
    content: content || '',
    transcript: content || '',
    thumbnail,
    videoId,
    hasTranscript,
    metadata: {
      duration,
      language: hasTranscript ? 'pt' : null,
      extractionMethod: hasTranscript ? 'success' : 'metadata_only',
      contentLength: content?.length || 0,
      transcriptUnavailable: !hasTranscript,
    },
  };
});
