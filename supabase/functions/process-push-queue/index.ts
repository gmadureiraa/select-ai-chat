import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webPush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueueItem {
  id: string;
  user_id: string;
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  };
}

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendPushToSubscription(
  subscription: PushSubscription,
  payload: QueueItem["payload"],
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
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
    
    await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    console.log("[process-push-queue] Push sent to:", subscription.endpoint.substring(0, 40));
    return true;
  } catch (error: unknown) {
    const err = error as { statusCode?: number };
    console.error("[process-push-queue] Push error:", err.statusCode || error);
    
    // 404/410 means subscription is expired
    if (err.statusCode === 404 || err.statusCode === 410) {
      return false; // Subscription should be removed
    }
    
    return true; // Other errors - keep subscription
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
      console.log("[process-push-queue] VAPID keys not configured, skipping");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "VAPID not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending items from queue (limit 100)
    const { data: queueItems, error: queueError } = await supabase
      .from("push_notification_queue")
      .select("id, user_id, payload")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(100);
    
    if (queueError) {
      console.error("[process-push-queue] Error fetching queue:", queueError);
      throw queueError;
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log("[process-push-queue] No pending items");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[process-push-queue] Processing", queueItems.length, "items");
    
    let totalSent = 0;
    const processedIds: string[] = [];
    const expiredSubscriptions: string[] = [];
    
    // Group by user_id to minimize DB queries
    const userIds = [...new Set(queueItems.map(item => item.user_id))];
    
    // Fetch all subscriptions for these users
    const { data: allSubscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);
    
    const subscriptionsByUser = (allSubscriptions || []).reduce((acc, sub) => {
      if (!acc[sub.user_id]) acc[sub.user_id] = [];
      acc[sub.user_id].push(sub);
      return acc;
    }, {} as Record<string, PushSubscription[]>);
    
    // Process each queue item
    for (const item of queueItems) {
      const userSubscriptions = subscriptionsByUser[item.user_id] || [];
      
      if (userSubscriptions.length === 0) {
        console.log("[process-push-queue] No subscriptions for user:", item.user_id.substring(0, 8));
        processedIds.push(item.id);
        continue;
      }
      
      // Send to all user's devices
      for (const subscription of userSubscriptions) {
        const success = await sendPushToSubscription(
          subscription,
          item.payload,
          vapidPublicKey,
          vapidPrivateKey
        );
        
        if (!success) {
          expiredSubscriptions.push(subscription.id);
        } else {
          totalSent++;
        }
      }
      
      processedIds.push(item.id);
    }
    
    // Mark processed items
    if (processedIds.length > 0) {
      await supabase
        .from("push_notification_queue")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .in("id", processedIds);
    }
    
    // Remove expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptions);
      console.log("[process-push-queue] Removed", expiredSubscriptions.length, "expired subscriptions");
    }
    
    console.log("[process-push-queue] Done. Sent:", totalSent, "Processed:", processedIds.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedIds.length,
        sent: totalSent,
        expiredRemoved: expiredSubscriptions.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-push-queue] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
