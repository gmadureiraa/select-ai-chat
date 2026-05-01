import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

type TestEventType =
  | "post.failed"
  | "post.partial"
  | "post.cancelled"
  | "account.disconnected"
  | "account.expired"
  | "ping";

interface TestRequest {
  eventType: TestEventType;
  clientId?: string;
}

async function sendTelegram(
  supabase: ReturnType<typeof createClient>,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
    return { ok: false, error: "Telegram keys not configured" };
  }

  const { data: config } = await supabase
    .from("telegram_bot_config")
    .select("chat_id")
    .eq("id", 1)
    .single();

  const chatId = (config as { chat_id?: number | string } | null)?.chat_id;
  if (!chatId) return { ok: false, error: "Telegram chat_id not configured" };

  const res = await fetch(`${TG_GATEWAY}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `Telegram ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Validate auth (must be a logged-in user)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
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
    const body = (await req.json()) as TestRequest;
    const { eventType, clientId } = body;

    let clientName = "Cliente de Teste";
    if (clientId) {
      const { data } = await supabase.from("clients").select("name").eq("id", clientId).single();
      if (data) clientName = (data as { name: string }).name;
    }

    let message = "";
    switch (eventType) {
      case "post.failed":
        message =
          `🧪 <b>[TESTE] Falha ao publicar</b>\n\n` +
          `<b>Cliente:</b> ${clientName}\n` +
          `<b>Plataforma:</b> instagram\n` +
          `<b>Título:</b> Post de teste do webhook\n` +
          `<b>Erro:</b> <code>Simulação manual disparada do kAI</code>`;
        break;
      case "post.partial":
        message =
          `🧪 <b>[TESTE] Publicação parcial</b>\n\n` +
          `<b>Cliente:</b> ${clientName}\n` +
          `<b>Falhou em:</b>\n<pre>• tiktok — token expirado\n• threads — rate limit</pre>`;
        break;
      case "post.cancelled":
        message =
          `🧪 <b>[TESTE] Post cancelado na Late</b>\n\n` +
          `<b>Cliente:</b> ${clientName}\n` +
          `<b>Plataforma:</b> instagram`;
        break;
      case "account.disconnected":
        message =
          `🧪 <b>[TESTE] Conta DESCONECTOU</b>\n\n` +
          `<b>Cliente:</b> ${clientName}\n` +
          `<b>Plataforma:</b> instagram\n\n` +
          `⚠️ Reconecte em <i>Cliente → Integrações</i> para retomar publicações.`;
        break;
      case "account.expired":
        message =
          `🧪 <b>[TESTE] Conta EXPIROU</b>\n\n` +
          `<b>Cliente:</b> ${clientName}\n` +
          `<b>Plataforma:</b> tiktok\n\n` +
          `⚠️ Reconecte para retomar publicações.`;
        break;
      case "ping":
      default:
        message = `🧪 <b>Webhook ping OK</b>\n\nDisparado por <i>${userData.user.email}</i> em ${new Date().toLocaleString("pt-BR")}.`;
        break;
    }

    const tgResult = await sendTelegram(supabase, message);

    await supabase.from("webhook_events_log").insert({
      source: "late",
      event_type: eventType,
      payload: { test: true, triggered_by: userData.user.email, clientId },
      processed_ok: tgResult.ok,
      error_message: tgResult.error || null,
      client_id: clientId || null,
      is_test: true,
    });

    if (!tgResult.ok) {
      return new Response(
        JSON.stringify({ success: false, error: tgResult.error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, eventType, sentTo: "telegram" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
