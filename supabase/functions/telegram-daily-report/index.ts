import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

serve(async () => {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY is not configured');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get chat_id
  const { data: config } = await supabase
    .from('telegram_bot_config')
    .select('chat_id, is_active')
    .eq('id', 1)
    .single();

  if (!config?.chat_id || !config?.is_active) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'No chat_id or inactive' }));
  }

  const headers = {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': TELEGRAM_API_KEY,
    'Content-Type': 'application/json',
  };

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Gather stats
  const [pending, approved, publishedYesterday, publishedToday, rejected] = await Promise.all([
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'idea'),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('updated_at', yesterday).lt('updated_at', today),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('updated_at', today),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'rejected').gte('updated_at', yesterday),
  ]);

  // Get upcoming scheduled items
  const { data: upcoming } = await supabase
    .from('planning_items')
    .select('title, platform, scheduled_at')
    .eq('status', 'approved')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', today)
    .order('scheduled_at', { ascending: true })
    .limit(5);

  const upcomingText = upcoming && upcoming.length > 0
    ? '\n\n📅 <b>Próximos agendados:</b>\n' + upcoming.map((i: any) => {
        const date = new Date(i.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `• ${i.title?.substring(0, 50)} (${i.platform || 'N/A'}) — ${date}`;
      }).join('\n')
    : '';

  const message = [
    `☀️ <b>Relatório Diário — kAI</b>`,
    ``,
    `📝 Pendentes: <b>${pending.count || 0}</b>`,
    `✅ Aprovados: <b>${approved.count || 0}</b>`,
    `📤 Publicados ontem: <b>${publishedYesterday.count || 0}</b>`,
    `📤 Publicados hoje: <b>${publishedToday.count || 0}</b>`,
    `❌ Reprovados ontem: <b>${rejected.count || 0}</b>`,
    upcomingText,
  ].join('\n');

  const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chat_id: config.chat_id,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  const data = await response.json();
  
  return new Response(JSON.stringify({ ok: response.ok, message_id: data?.result?.message_id }));
});
