import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(base64Data);
  const buffer = new ArrayBuffer(binaryString.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binaryString.length; i++) {
    view[i] = binaryString.charCodeAt(i);
  }
  return buffer;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const body = await req.json();
    const { url, base64, mimeType, fileName } = body;

    if (!url && !base64) {
      throw new Error('URL ou base64 é obrigatório');
    }

    let audioBlob: Blob;
    let audioFileName = fileName || 'media.mp3';

    if (url) {
      // Download from URL
      console.log('Downloading from URL:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao baixar mídia: ${response.status}`);
      }
      audioBlob = await response.blob();
      
      // Try to extract filename from URL
      const urlPath = new URL(url).pathname;
      const urlFileName = urlPath.split('/').pop();
      if (urlFileName) {
        audioFileName = urlFileName;
      }
    } else {
      // Convert base64 to blob
      console.log('Processing base64 data');
      const buffer = base64ToArrayBuffer(base64);
      const type = mimeType || 'audio/mp3';
      audioBlob = new Blob([buffer], { type });
      
      // Set extension based on mime type
      if (type.includes('video')) {
        audioFileName = 'video.mp4';
      } else if (type.includes('audio')) {
        audioFileName = 'audio.mp3';
      }
    }

    console.log('Media size:', audioBlob.size, 'bytes');
    console.log('Media filename:', audioFileName);

    // Validate file format - Whisper only accepts these formats
    const validExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
    // Decode URL-encoded filename first
    let decodedFileName = decodeURIComponent(audioFileName);
    let fileExtension = decodedFileName.split('.').pop()?.toLowerCase() || '';
    
    // Handle opus files - Whisper accepts ogg but not opus directly
    // Opus is typically in an ogg container, so we rename the extension
    if (fileExtension === 'opus') {
      console.log('Converting opus extension to ogg for Whisper compatibility');
      decodedFileName = decodedFileName.replace(/\.opus$/i, '.ogg');
      fileExtension = 'ogg';
    }
    
    // Update the filename to use decoded version
    audioFileName = decodedFileName;
    
    // Check if it's an image (not supported)
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    if (imageExtensions.includes(fileExtension)) {
      console.log('Skipping transcription - file is an image:', audioFileName);
      return new Response(JSON.stringify({
        text: '',
        duration: 0,
        language: null,
        segments: [],
        skipped: true,
        reason: 'Imagens não podem ser transcritas. Apenas arquivos de áudio/vídeo são suportados.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check file size (max 25MB for Whisper)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioBlob.size > MAX_SIZE) {
      const fileSizeMB = (audioBlob.size / 1024 / 1024).toFixed(2);
      console.log(`File too large: ${fileSizeMB}MB (max 25MB)`);
      return new Response(JSON.stringify({ 
        error: `Arquivo muito grande para transcrição. Máximo: 25MB. Seu arquivo: ${fileSizeMB}MB. Tente comprimir o vídeo ou usar um arquivo menor.`,
        fileTooLarge: true,
        fileSize: audioBlob.size,
        maxSize: MAX_SIZE
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create FormData for OpenAI
    const formData = new FormData();
    formData.append('file', audioBlob, audioFileName);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'verbose_json');

    console.log('Sending to OpenAI Whisper API...');
    
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Erro na transcrição: ${whisperResponse.status}`);
    }

    const result = await whisperResponse.json();
    console.log('Transcription complete, duration:', result.duration, 'seconds');

    return new Response(JSON.stringify({
      text: result.text,
      duration: result.duration,
      language: result.language,
      segments: result.segments || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in transcribe-media:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao transcrever mídia';
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
