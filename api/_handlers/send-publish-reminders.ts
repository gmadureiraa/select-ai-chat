// Migrated from supabase/functions/send-publish-reminders/index.ts
import { anonPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

export default anonPost(async () => {
  console.log('[send-publish-reminders] Starting...');
  await getPool().query(`SELECT create_publish_reminders()`);
  return { success: true, message: 'Publish reminders sent' };
});
