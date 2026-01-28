import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webPush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const payloadString = JSON.stringify(payload);
    
    webPush.setVapidDetails(
      "mailto:contato@kaleidos.cc",
      vapidPublicKey,
      vapidPrivateKey
    );
    
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };
    
    await webPush.sendNotification(pushSubscription, payloadString);
    console.log("[send-push] Push sent successfully to:", subscription.endpoint.substring(0, 50));
    return true;
  } catch (error: unknown) {
    console.error("[send-push] Error sending push:", error);
    
    // Check if subscription is expired/invalid
    const err = error as { statusCode?: number };
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log("[send-push] Subscription expired, should be removed");
      return false;
    }
    
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, workspaceId, payload } = await req.json();
    
    console.log("[send-push] Sending push to user:", userId);

    // Fetch user's push subscriptions
    let query = supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    
    if (userId) {
      query = query.eq("user_id", userId);
    } else if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    } else {
      throw new Error("userId or workspaceId required");
    }
    
    const { data: subscriptions, error: subError } = await query;
    
    if (subError) {
      console.error("[send-push] Error fetching subscriptions:", subError);
      throw subError;
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[send-push] No subscriptions found for user");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[send-push] Found", subscriptions.length, "subscription(s)");
    
    // Send to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const success = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );
        
        // Remove expired subscriptions
        if (!success) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          console.log("[send-push] Removed expired subscription:", sub.id);
        }
        
        return success;
      })
    );
    
    const successCount = results.filter(Boolean).length;
    console.log("[send-push] Sent:", successCount, "/", subscriptions.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: subscriptions.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-push] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
