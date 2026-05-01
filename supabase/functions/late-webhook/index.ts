import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-late-signature",
};

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

interface LateWebhookEvent {
  type:
    | 'post.published'
    | 'post.failed'
    | 'post.scheduled'
    | 'post.partial'
    | 'post.cancelled'
    | 'post.recycled'
    | 'account.connected'
    | 'account.disconnected'
    | 'account.expired';
  postId?: string;
  accountId?: string;
  profileId?: string;
  platform?: string;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
  timestamp?: string;
  socialAccountId?: string;
  socialPlatform?: string;
  accountName?: string;
  failedPlatforms?: Array<{ platform: string; error?: string }>;
}

function escapeHtml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function verifyWebhookSignature(req: Request): Promise<{ valid: boolean; body: string }> {
  const signature = req.headers.get("x-late-signature");
  const secret = Deno.env.get("LATE_WEBHOOK_SECRET");

  const body = await req.text();

  if (!secret) {
    console.error("LATE_WEBHOOK_SECRET not configured — rejecting webhook");
    return { valid: false, body };
  }

  if (!signature) {
    console.error("Missing x-late-signature header");
    return { valid: false, body };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature !== expected) {
    console.error("Invalid webhook signature");
    return { valid: false, body };
  }

  return { valid: true, body };
}

async function alertsEnabledForClient(
  supabase: ReturnType<typeof createClient>,
  clientId: string | null | undefined,
): Promise<boolean> {
  if (!clientId) return true;
  const { data } = await supabase
    .from("webhook_alert_preferences")
    .select("alerts_enabled")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return true; // default ON
  return (data as { alerts_enabled: boolean }).alerts_enabled;
}

async function sendTelegram(
  supabase: ReturnType<typeof createClient>,
  text: string,
  clientId?: string | null,
): Promise<void> {
  try {
    if (!(await alertsEnabledForClient(supabase, clientId))) {
      console.log("Alerts disabled for client", clientId, "— skipping Telegram");
      return;
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
      console.warn("Telegram keys not configured, skipping notification");
      return;
    }

    const { data: config } = await supabase
      .from("telegram_bot_config")
      .select("chat_id")
      .eq("id", 1)
      .single();

    const chatId = (config as { chat_id?: number | string } | null)?.chat_id;
    if (!chatId) {
      console.warn("No telegram chat_id configured, skipping notification");
      return;
    }

    const res = await fetch(`${TG_GATEWAY}/sendMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
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
      const data = await res.text();
      console.error("Telegram send failed:", res.status, data);
    }
  } catch (e) {
    console.error("Telegram notify error:", e);
  }
}

async function getClientName(
  supabase: ReturnType<typeof createClient>,
  clientId: string | null | undefined,
): Promise<string> {
  if (!clientId) return "Cliente";
  const { data } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();
  return (data as { name?: string } | null)?.name || "Cliente";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  let parsedEvent: LateWebhookEvent | null = null;
  let rawPayload: unknown = null;

  try {
    const { valid, body } = await verifyWebhookSignature(req);
    if (!valid) {
      await supabase.from("webhook_events_log").insert({
        source: "late",
        event_type: "invalid_signature",
        payload: { body_preview: body.substring(0, 500) },
        processed_ok: false,
        error_message: "Invalid or missing x-late-signature",
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event: LateWebhookEvent = JSON.parse(body);
    parsedEvent = event;
    rawPayload = event;

    console.log("Late webhook received:", event.type);

    // ─────── ACCOUNT EVENTS ───────
    if (event.type === "account.disconnected" || event.type === "account.expired") {
      const accountId = event.accountId || event.socialAccountId;
      const platform = event.platform || event.socialPlatform || "rede social";

      let affectedClientName = "um cliente";
      let affectedClientId: string | null = null;

      if (accountId) {
        const { data: credentials } = await supabase
          .from("client_social_credentials")
          .select("id, client_id, platform")
          .or(`metadata->late_account_id.eq.${accountId},metadata->late_profile_id.eq.${accountId}`);

        if (credentials && credentials.length > 0) {
          for (const cred of credentials as Array<{ id: string; client_id: string; platform: string }>) {
            if (event.type === "account.disconnected") {
              await supabase.from("client_social_credentials").delete().eq("id", cred.id);
            } else {
              await supabase
                .from("client_social_credentials")
                .update({
                  is_valid: false,
                  validation_error: "Conta expirada no Late API",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", cred.id);
            }
            affectedClientId = cred.client_id;
            affectedClientName = await getClientName(supabase, cred.client_id);
          }
        }
      }

      const emoji = event.type === "account.disconnected" ? "🔌" : "⏰";
      const verb = event.type === "account.disconnected" ? "DESCONECTOU" : "EXPIROU";
      await sendTelegram(
        supabase,
        `${emoji} <b>Conta ${verb}</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(affectedClientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platform)}\n` +
          (event.accountName ? `<b>Conta:</b> ${escapeHtml(event.accountName)}\n` : "") +
          `\n⚠️ Reconecte em <i>Cliente → Integrações</i> para retomar publicações.`,
        affectedClientId,
      );

      await supabase.from("webhook_events_log").insert({
        source: "late",
        event_type: event.type,
        payload: rawPayload,
        related_client_id: affectedClientId,
        client_id: affectedClientId,
        processed_ok: true,
      });

      return new Response(JSON.stringify({ success: true, eventType: event.type }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For post events, postId is required
    if (!event.postId) {
      await supabase.from("webhook_events_log").insert({
        source: "late",
        event_type: event.type,
        payload: rawPayload,
        processed_ok: true,
        error_message: "skipped — no postId",
      });
      return new Response(JSON.stringify({ success: true, message: "Event skipped - no postId" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: planningItem, error: findError } = await supabase
      .from("planning_items")
      .select("*")
      .eq("external_post_id", event.postId)
      .single();

    if (findError || !planningItem) {
      await supabase.from("webhook_events_log").insert({
        source: "late",
        event_type: event.type,
        payload: rawPayload,
        processed_ok: true,
        error_message: "no matching planning item",
      });
      return new Response(JSON.stringify({ success: true, message: "No matching planning item found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const item = planningItem as Record<string, any>;
    const clientName = await getClientName(supabase, item.client_id);
    const platformLabel = item.platform || event.platform || "—";

    // ─────── post.published ───────
    if (event.type === "post.published") {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};

      let publishedColumnId = item.column_id;
      if (item.workspace_id) {
        const { data: publishedColumn } = await supabase
          .from("kanban_columns")
          .select("id")
          .eq("workspace_id", item.workspace_id)
          .eq("column_type", "published")
          .single();
        if (publishedColumn) publishedColumnId = (publishedColumn as { id: string }).id;
      }

      await supabase
        .from("planning_items")
        .update({
          status: "published",
          published_at: event.timestamp || new Date().toISOString(),
          error_message: null,
          column_id: publishedColumnId,
          metadata: {
            ...existingMetadata,
            published_url: event.platformPostUrl,
            platform_post_id: event.platformPostId,
            published_via_webhook: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (!item.added_to_library && item.client_id) {
        const contentTypeMap: Record<string, string> = {
          twitter: "tweet",
          linkedin: "linkedin_post",
          instagram: "instagram_post",
          facebook: "facebook_post",
          tiktok: "tiktok_video",
          youtube: "youtube_video",
          threads: "threads_post",
        };

        await supabase.from("client_content_library").insert({
          client_id: item.client_id,
          title: (item.content || item.title || "").substring(0, 100),
          content: item.content || item.title || "",
          content_type: contentTypeMap[item.platform || ""] || "post",
          content_url: event.platformPostUrl,
          metadata: {
            platform: item.platform,
            posted_at: event.timestamp || new Date().toISOString(),
            late_post_id: event.postId,
            via_webhook: true,
          },
        });

        await supabase.from("planning_items").update({ added_to_library: true }).eq("id", item.id);
      }
    }

    // ─────── post.failed ───────
    else if (event.type === "post.failed") {
      await supabase
        .from("planning_items")
        .update({
          status: "failed",
          error_message: event.error || "Falha ao publicar automaticamente",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await sendTelegram(
        supabase,
        `🔴 <b>Falha ao publicar</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platformLabel)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || "—")}\n` +
          `<b>Erro:</b> <code>${escapeHtml(event.error || "Desconhecido")}</code>\n\n` +
          `Abra no kAI para revisar e republicar.`,
        item.client_id,
      );
    }

    // ─────── post.scheduled ───────
    else if (event.type === "post.scheduled") {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await supabase
        .from("planning_items")
        .update({
          status: "scheduled",
          metadata: {
            ...existingMetadata,
            late_confirmed: true,
            late_scheduled_at: event.timestamp,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }

    // ─────── post.partial ───────
    else if (event.type === "post.partial") {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await supabase
        .from("planning_items")
        .update({
          status: "partial",
          metadata: {
            ...existingMetadata,
            failed_platforms: event.failedPlatforms || [],
            published_url: event.platformPostUrl,
            partial_at: event.timestamp || new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      const failedList = (event.failedPlatforms || [])
        .map((f) => `• ${f.platform}${f.error ? ` — ${f.error}` : ""}`)
        .join("\n") || "(plataformas não informadas)";

      await sendTelegram(
        supabase,
        `🟡 <b>Publicação parcial</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || "—")}\n\n` +
          `<b>Falhou em:</b>\n<pre>${escapeHtml(failedList)}</pre>`,
        item.client_id,
      );
    }

    // ─────── post.cancelled ───────
    else if (event.type === "post.cancelled") {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await supabase
        .from("planning_items")
        .update({
          status: "cancelled",
          metadata: {
            ...existingMetadata,
            cancelled_at: event.timestamp || new Date().toISOString(),
            cancelled_via_webhook: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await sendTelegram(
        supabase,
        `🟡 <b>Post cancelado na Late</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platformLabel)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || "—")}`,
        item.client_id,
      );
    }

    // ─────── post.recycled ───────
    else if (event.type === "post.recycled") {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await supabase
        .from("planning_items")
        .update({
          metadata: {
            ...existingMetadata,
            recycled_at: event.timestamp || new Date().toISOString(),
            recycled_post_id: event.platformPostId,
            recycled_url: event.platformPostUrl,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      // silencioso (sem Telegram)
    }

    await supabase.from("webhook_events_log").insert({
      source: "late",
      event_type: event.type,
      payload: rawPayload,
      processed_ok: true,
      related_planning_item_id: item.id,
      related_client_id: item.client_id,
      client_id: item.client_id,
    });

    return new Response(JSON.stringify({ success: true, eventType: event.type }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro em late-webhook:", error);
    try {
      await supabase.from("webhook_events_log").insert({
        source: "late",
        event_type: parsedEvent?.type || "unknown",
        payload: rawPayload,
        processed_ok: false,
        error_message: error instanceof Error ? error.message : String(error),
      });
    } catch (_) {
      /* ignore */
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
