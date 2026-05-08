// Adapter SV: /api/profile-scraper → instagram-search.
// SV onboarding scrape um @handle pra puxar últimos posts pra análise.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import instagramSearch from './instagram-search.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return (instagramSearch as any)(req, res);
}
