import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-late-signature",
};

interface LateWebhookEvent {
  type: 'post.published' | 'post.failed' | 'post.scheduled';
  postId: string;
  platform?: string;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
  timestamp?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse webhook payload
    const event: LateWebhookEvent = await req.json();
    
    console.log("Late webhook received:", event);

    if (!event.postId) {
      return new Response(JSON.stringify({ error: "postId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find planning item by external_post_id (Late post ID)
    const { data: planningItem, error: findError } = await supabase
      .from("planning_items")
      .select("*")
      .eq("external_post_id", event.postId)
      .single();

    if (findError || !planningItem) {
      console.log("Planning item not found for postId:", event.postId);
      // Not an error - might be a post created outside our system
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No matching planning item found" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Found planning item:", planningItem.id, planningItem.title);

    // Handle different event types
    if (event.type === 'post.published') {
      // Update planning item to published status
      const existingMetadata = (planningItem.metadata as Record<string, unknown>) || {};
      
      const { error: updateError } = await supabase
        .from("planning_items")
        .update({
          status: "published",
          published_at: event.timestamp || new Date().toISOString(),
          error_message: null,
          metadata: {
            ...existingMetadata,
            published_url: event.platformPostUrl,
            platform_post_id: event.platformPostId,
            published_via_webhook: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", planningItem.id);

      if (updateError) {
        console.error("Error updating planning item:", updateError);
        throw updateError;
      }

      // Add to content library if not already
      if (!planningItem.added_to_library && planningItem.client_id) {
        const contentTypeMap: Record<string, string> = {
          twitter: 'tweet',
          linkedin: 'linkedin_post',
          instagram: 'instagram_post',
          facebook: 'facebook_post',
          tiktok: 'tiktok_video',
          youtube: 'youtube_video',
          threads: 'threads_post',
        };

        await supabase
          .from("client_content_library")
          .insert({
            client_id: planningItem.client_id,
            title: (planningItem.content || planningItem.title || '').substring(0, 100),
            content: planningItem.content || planningItem.title || '',
            content_type: contentTypeMap[planningItem.platform || ''] || 'post',
            content_url: event.platformPostUrl,
            metadata: {
              platform: planningItem.platform,
              posted_at: event.timestamp || new Date().toISOString(),
              late_post_id: event.postId,
              via_webhook: true,
            },
          });

        await supabase
          .from("planning_items")
          .update({ added_to_library: true })
          .eq("id", planningItem.id);
      }

      console.log("Planning item updated to published:", planningItem.id);

    } else if (event.type === 'post.failed') {
      // Update planning item to failed status
      const { error: updateError } = await supabase
        .from("planning_items")
        .update({
          status: "failed",
          error_message: event.error || "Falha ao publicar automaticamente",
          updated_at: new Date().toISOString(),
        })
        .eq("id", planningItem.id);

      if (updateError) {
        console.error("Error updating planning item:", updateError);
        throw updateError;
      }

      console.log("Planning item marked as failed:", planningItem.id);

    } else if (event.type === 'post.scheduled') {
      // Confirm that post was scheduled successfully
      const existingMetadata = (planningItem.metadata as Record<string, unknown>) || {};
      
      const { error: updateError } = await supabase
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
        .eq("id", planningItem.id);

      if (updateError) {
        console.error("Error updating planning item:", updateError);
        throw updateError;
      }

      console.log("Planning item confirmed as scheduled:", planningItem.id);
    }

    return new Response(JSON.stringify({ 
      success: true,
      planningItemId: planningItem.id,
      eventType: event.type,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro em late-webhook:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
