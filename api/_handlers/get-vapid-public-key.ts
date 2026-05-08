// Migrated from supabase/functions/get-vapid-public-key/index.ts
import { anonPost } from '../_lib/handler.js';

export default anonPost(async () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error('VAPID_PUBLIC_KEY not configured');
  return { publicKey };
});
