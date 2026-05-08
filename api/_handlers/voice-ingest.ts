// Adapter SV: /api/voice-ingest → generate-voice-profile.
// Settings SV chama pra ingestar samples de voz e gerar voice_profile.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import generateVoiceProfile from './generate-voice-profile.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return (generateVoiceProfile as any)(req, res);
}
