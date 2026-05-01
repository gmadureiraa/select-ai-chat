import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function sendTelegram(
  supabase: ReturnType<typeof createClient>,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return { ok: false, error: "Telegram not configured" };

  const { data: config } = await supabase
    .from("telegram_bot_config")
    .select("chat_id")
    .eq("id", 1)
    .single();
  const chatId = (config as { chat_id?: number | string } | null)?.chat_id;
  if (!chatId) return { ok: false, error: "No chat_id" };

  const res = await fetch(`${TG_GATEWAY}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) return { ok: false, error: `${res.status}: ${await res.text()}` };
  return { ok: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { eventLogId } = (await req.json()) as { eventLogId: string };
    if (!eventLogId) {
      return new Response(JSON.stringify({ error: "Missing eventLogId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: log, error: logErr } = await supabase
      .from("webhook_events_log")
      .select("*")
      .eq("id", eventLogId)
      .single();

    if (logErr || !log) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ev = log as Record<string, any>;

    // Resend Telegram alert summarizing the event for the user
    const summary =
      `🔁 <b>Reprocessando webhook</b>\n\n` +
      `<b>Tipo:</b> <code>${ev.event_type}</code>\n` +
      `<b>Recebido em:</b> ${new Date(ev.created_at).toLocaleString("pt-BR")}\n` +
      (ev.error_message ? `<b>Erro original:</b> <code>${String(ev.error_message).substring(0, 200)}</code>\n` : "") +
      `\nReprocessado por <i>${userData.user.email}</i>.`;

    const tg = await sendTelegram(supabase, summary);

    await supabase
      .from("webhook_events_log")
      .update({
        retry_count: (ev.retry_count || 0) + 1,
        processed_ok: tg.ok ? true : ev.processed_ok,
        error_message: tg.ok ? null : ev.error_message,
      })
      .eq("id", eventLogId);

    return new Response(
      JSON.stringify({ success: true, telegram: tg.ok, retryCount: (ev.retry_count || 0) + 1 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
