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

  // Gather stats — only real pending work (drafts/review aguardando ação)
  const [drafts, inReview, approved, publishedYesterday, publishedToday] = await Promise.all([
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'review'),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('updated_at', yesterday).lt('updated_at', today),
    supabase.from('planning_items').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('updated_at', today),
  ]);

  const totalPending = (drafts.count || 0) + (inReview.count || 0);

  // Get upcoming scheduled items (next 7 days, scheduled OR approved)
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString();
  const { data: upcoming } = await supabase
    .from('planning_items')
    .select('title, platform, scheduled_at, status')
    .in('status', ['scheduled', 'approved'])
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', in7Days)
    .order('scheduled_at', { ascending: true })
    .limit(8);

  const upcomingText = upcoming && upcoming.length > 0
    ? '\n\n📅 <b>Próximos 7 dias:</b>\n' + upcoming.map((i: any) => {
        const date = new Date(i.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `• ${(i.title || '').substring(0, 50)} (${i.platform || 'N/A'}) — ${date}`;
      }).join('\n')
    : '\n\n✨ Nenhum agendado para os próximos 7 dias.';

  const pendingLine = totalPending === 0
    ? `🎉 <b>Zero pendências!</b> Tudo em dia.`
    : `📝 Pendentes: <b>${totalPending}</b> (${drafts.count || 0} rascunhos, ${inReview.count || 0} em revisão)`;

  const message = [
    `☀️ <b>Relatório Diário — kAI</b>`,
    ``,
    pendingLine,
    `✅ Aprovados aguardando agendamento: <b>${approved.count || 0}</b>`,
    `📤 Publicados ontem: <b>${publishedYesterday.count || 0}</b>`,
    `📤 Publicados hoje: <b>${publishedToday.count || 0}</b>`,
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
