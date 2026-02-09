import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailQueueItem {
  id: string;
  user_id: string;
  notification_id: string;
  email: string;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  workspace_id: string;
  metadata: Record<string, unknown> | null;
}

interface Workspace {
  slug: string;
  name: string;
}

const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ========================================
  // SECURITY: Validate cron/service caller
  // ========================================
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  // Accept requests from:
  // 1. Supabase internal cron scheduler headers
  // 2. Service role key authentication
  // 3. pg_cron via net.http_post (sends anon key)
  const isCronJob = req.headers.get("x-supabase-eed-request") === "true" || 
                    req.headers.get("user-agent")?.includes("Supabase") ||
                    req.headers.get("x-supabase-cron") === "true";
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const isPgCron = !!anonKey && authHeader === `Bearer ${anonKey}`;

  if (!isCronJob && !isServiceRole && !isPgCron) {
    console.error("[process-email-notifications] Unauthorized access attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized - Service role required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  console.log(`[process-email-notifications] Auth check passed: isCronJob=${isCronJob}, isServiceRole=${isServiceRole}`);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("[process-email-notifications] RESEND_API_KEY not configured, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Email not configured, skipping" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar emails pendentes
    const { data: queueItems, error: queueError } = await supabase
      .from("email_notification_queue")
      .select("*")
      .is("sent_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (queueError) {
      console.error("[process-email-notifications] Error fetching queue:", queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("[process-email-notifications] No pending emails");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-email-notifications] Processing ${queueItems.length} emails`);

    let successCount = 0;
    let errorCount = 0;

    for (const item of queueItems as EmailQueueItem[]) {
      try {
        // Buscar dados da notificação
        const { data: notification, error: notifError } = await supabase
          .from("notifications")
          .select("*")
          .eq("id", item.notification_id)
          .single();

        if (notifError || !notification) {
          console.error(`[process-email-notifications] Notification not found: ${item.notification_id}`);
          await markAsError(supabase, item.id, "Notification not found");
          errorCount++;
          continue;
        }

        const notif = notification as Notification;

        // Buscar workspace para o slug
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("slug, name")
          .eq("id", notif.workspace_id)
          .single();

        const ws = workspace as Workspace | null;

        // Construir link para o app
        const appUrl = buildAppUrl(notif, ws?.slug);
        
        // Construir conteúdo do email
        const subject = `[KAI] ${notif.title}`;
        const htmlContent = buildEmailHtml(notif, ws, appUrl);

        // Enviar email - usa domínio verificado ou fallback para resend.dev
        const fromEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "KAI <onboarding@resend.dev>";
        
        const { error: sendError } = await resend.emails.send({
          from: fromEmail,
          to: [item.email],
          subject,
          html: htmlContent,
        });

        if (sendError) {
          console.error(`[process-email-notifications] Error sending to ${item.email}:`, sendError);
          await markAsError(supabase, item.id, sendError.message || "Send failed");
          errorCount++;
          continue;
        }

        // Marcar como enviado
        await supabase
          .from("email_notification_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", item.id);

        console.log(`[process-email-notifications] Email sent to ${item.email}`);
        successCount++;

      } catch (itemError) {
        console.error(`[process-email-notifications] Error processing item ${item.id}:`, itemError);
        await markAsError(supabase, item.id, String(itemError));
        errorCount++;
      }
    }

    console.log(`[process-email-notifications] Completed: ${successCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: queueItems.length,
        sent: successCount,
        errors: errorCount 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[process-email-notifications] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function markAsError(supabase: any, id: string, error: string) {
  await supabase
    .from("email_notification_queue")
    .update({ error, sent_at: new Date().toISOString() })
    .eq("id", id);
}

function buildAppUrl(notif: Notification, workspaceSlug: string | undefined): string {
  const baseUrl = "https://kai-kaleidos.lovable.app";
  
  if (!workspaceSlug) {
    return baseUrl;
  }

  let url = `${baseUrl}/${workspaceSlug}`;

  // Adicionar parâmetros baseados no tipo de entidade
  if (notif.entity_type === "planning_item" && notif.entity_id) {
    url += `?tab=planning&openItem=${notif.entity_id}`;
  } else if (notif.entity_type === "kanban_card" && notif.entity_id) {
    url += `?tab=kanban&openCard=${notif.entity_id}`;
  } else if (notif.entity_type === "automation" && notif.entity_id) {
    url += `?tab=automations`;
  }

  return url;
}

function buildEmailHtml(notif: Notification, workspace: Workspace | null, appUrl: string): string {
  const typeLabels: Record<string, string> = {
    assignment: "📋 Nova atribuição",
    due_date: "📅 Lembrete de prazo",
    mention: "💬 Você foi mencionado",
    publish_reminder: "⏰ Lembrete de publicação",
    publish_failed: "❌ Falha na publicação",
    publish_success: "✅ Publicado com sucesso",
    automation_completed: "⚡ Automação executada",
  };

  const typeLabel = typeLabels[notif.type] || "🔔 Notificação";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notif.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">KAI</h1>
              ${workspace ? `<p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">${workspace.name}</p>` : ""}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px;">${typeLabel}</p>
              <h2 style="margin: 0 0 16px 0; color: white; font-size: 20px; font-weight: 600;">${notif.title}</h2>
              ${notif.message ? `<p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 16px; line-height: 1.5;">${notif.message}</p>` : ""}
              
              <a href="${appUrl}" style="display: inline-block; background-color: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">
                Abrir no KAI
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                Você recebeu este email porque ativou as notificações por email no KAI.
                <br><br>
                <a href="${appUrl}?tab=settings" style="color: #94a3b8; text-decoration: underline;">Gerenciar preferências</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
