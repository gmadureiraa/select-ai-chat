import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LATE_API_BASE = "https://getlate.dev/api";

interface ThreadItem {
  id?: string;
  text: string;
  media_urls?: string[];
}

interface MediaItem {
  url: string;
  type?: 'image' | 'video';
}

interface PostRequest {
  clientId: string;
  platform: 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'threads';
  content: string;
  mediaUrls?: string[];
  mediaItems?: MediaItem[];
  threadItems?: ThreadItem[]; // For native thread support
  planningItemId?: string;
  scheduledFor?: string; // ISO date string for scheduling
  publishNow?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // For auth verification use anon key
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { 
      clientId, 
      platform, 
      content, 
      mediaUrls, 
      mediaItems: inputMediaItems,
      threadItems,
      planningItemId, 
      scheduledFor, 
      publishNow = true 
    }: PostRequest = await req.json();

    if (!clientId || !platform) {
      return new Response(JSON.stringify({ error: "Cliente e plataforma são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Content validation
    const hasContent = content?.trim();
    const hasThreadItems = threadItems && threadItems.length > 0 && threadItems.some(t => t.text?.trim());
    
    if (!hasContent && !hasThreadItems) {
      return new Response(JSON.stringify({ error: "Conteúdo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");
    if (!LATE_API_KEY) {
      return new Response(JSON.stringify({ error: "LATE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credentials from database
    const { data: credentials, error: credError } = await supabase
      .from("client_social_credentials")
      .select("*")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .single();

    if (credError || !credentials) {
      console.error("Credenciais não encontradas:", { clientId, platform, credError });
      return new Response(JSON.stringify({ 
        error: `Conta ${platform} não conectada. Conecte a conta primeiro nas Integrações.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!credentials.is_valid) {
      console.error("Credenciais inválidas:", { clientId, platform, validationError: credentials.validation_error });
      return new Response(JSON.stringify({ 
        error: `Credenciais do ${platform} expiradas ou inválidas. Reconecte a conta.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Late account ID from metadata
    const metadata = credentials.metadata as Record<string, unknown> | null;
    const lateAccountId = metadata?.late_account_id || credentials.account_id;

    console.log("Publicando com credenciais:", { 
      clientId, 
      platform, 
      accountId: credentials.account_id,
      lateAccountId,
      accountName: credentials.account_name,
      hasThread: !!threadItems,
      threadCount: threadItems?.length || 0
    });

    if (!lateAccountId) {
      console.error("Late account ID não encontrado:", { clientId, platform, metadata });
      return new Response(JSON.stringify({ 
        error: "Conta não configurada corretamente. Reconecte nas Integrações." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build media items array
    let finalMediaItems: Array<{ type: string; url: string }> = [];
    
    if (inputMediaItems && inputMediaItems.length > 0) {
      finalMediaItems = inputMediaItems.map(m => ({
        type: m.type || (m.url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
        url: m.url,
      }));
    } else if (mediaUrls && mediaUrls.length > 0) {
      finalMediaItems = mediaUrls.map(url => ({
        type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
        url: url,
      }));
    }

    // Build post payload for Late API
    const postPayload: Record<string, unknown> = {
      publishNow: publishNow,
    };

    // Handle threads (for Twitter/X and Threads)
    if (threadItems && threadItems.length > 0 && (platform === 'twitter' || platform === 'threads')) {
      // Use native thread support
      const lateThreadItems = threadItems.map(item => {
        const threadItem: Record<string, unknown> = {
          content: item.text,
        };
        
        // Add media to thread item if present
        if (item.media_urls && item.media_urls.length > 0) {
          threadItem.mediaItems = item.media_urls.map(url => ({
            type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
            url: url,
          }));
        }
        
        return threadItem;
      });

      // First item content goes to main content
      postPayload.content = lateThreadItems[0]?.content || content;
      
      // Thread items go to platformSpecificData
      postPayload.platforms = [{
        platform: platform,
        accountId: lateAccountId,
        platformSpecificData: {
          threadItems: lateThreadItems.slice(1), // Remaining items after first
        }
      }];

      // Add first item's media to main mediaItems
      if (threadItems[0]?.media_urls && threadItems[0].media_urls.length > 0) {
        postPayload.mediaItems = threadItems[0].media_urls.map(url => ({
          type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
          url: url,
        }));
      }
    } else {
      // Standard post (non-thread)
      postPayload.content = content;
      postPayload.platforms = [{
        platform: platform,
        accountId: lateAccountId,
      }];

      if (finalMediaItems.length > 0) {
        postPayload.mediaItems = finalMediaItems;
      }
    }

    // Add scheduled time if provided
    if (scheduledFor && !publishNow) {
      postPayload.scheduledFor = scheduledFor;
      postPayload.publishNow = false;
    }

    console.log("Late API payload:", JSON.stringify(postPayload, null, 2));

    // Post via Late API
    const postResponse = await fetch(`${LATE_API_BASE}/v1/posts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
    });

    const responseText = await postResponse.text();
    console.log("Late API response:", { 
      status: postResponse.status, 
      ok: postResponse.ok,
      body: responseText.substring(0, 500) 
    });

    if (!postResponse.ok) {
      console.error("Erro Late API:", { 
        status: postResponse.status, 
        body: responseText,
        clientId,
        platform,
        lateAccountId 
      });
      
      // Update planning item if applicable
      if (planningItemId) {
        await supabase
          .from("planning_items")
          .update({
            status: "failed",
            error_message: `Erro ao publicar (${postResponse.status}): ${responseText.substring(0, 200)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", planningItemId);
      }

      // Parse error for better user message
      let userMessage = "Falha ao publicar conteúdo";
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.message) {
          userMessage = errorJson.message;
        } else if (errorJson.error) {
          userMessage = errorJson.error;
        }
      } catch {
        // Keep default message if not JSON
        if (responseText.includes("rate limit")) {
          userMessage = "Limite de publicações atingido. Tente novamente mais tarde.";
        } else if (responseText.includes("unauthorized") || responseText.includes("401")) {
          userMessage = "Credenciais expiradas. Reconecte a conta.";
        }
      }

      return new Response(JSON.stringify({ 
        error: userMessage,
        details: responseText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let postData;
    try {
      postData = JSON.parse(responseText);
    } catch {
      postData = { message: "Publicado com sucesso" };
    }
    
    console.log("Publicação bem sucedida:", postData);

    // Extract published URL from response
    const publishedUrl = postData.post?.platforms?.[0]?.platformPostUrl || 
                        postData.post?.platforms?.[0]?.publishedUrl ||
                        postData.post?.url ||
                        null;

    // Determine new status based on whether post was scheduled or published
    const newStatus = publishNow ? "published" : "scheduled";

    // Update planning item status if applicable
    if (planningItemId) {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        error_message: null,
        updated_at: new Date().toISOString(),
        external_post_id: postData.post?._id || postData.postId,
      };

      if (publishNow) {
        updateData.published_at = new Date().toISOString();
      }

      // metadata will be merged below after fetching current item

      if (scheduledFor) {
        updateData.scheduled_at = scheduledFor;
      }

      // Get current item to merge metadata and get workspace_id
      const { data: currentItem } = await supabase
        .from("planning_items")
        .select("metadata, workspace_id")
        .eq("id", planningItemId)
        .single();

      if (currentItem) {
        const existingMetadata = (currentItem.metadata as Record<string, unknown>) || {};
        updateData.metadata = {
          ...existingMetadata,
          published_url: publishedUrl,
          late_post_id: postData.post?._id,
          late_confirmed: !publishNow, // Confirmed if scheduled
        };

        // If published, move to "published" column
        if (publishNow && currentItem.workspace_id) {
          const { data: publishedColumn } = await supabase
            .from("kanban_columns")
            .select("id")
            .eq("workspace_id", currentItem.workspace_id)
            .eq("column_type", "published")
            .single();
          
          if (publishedColumn) {
            updateData.column_id = publishedColumn.id;
          }
        }
      }

      await supabase
        .from("planning_items")
        .update(updateData)
        .eq("id", planningItemId);

      // Also save to client content library if published
      if (publishNow) {
        const contentTypeMap: Record<string, string> = {
          twitter: 'tweet',
          linkedin: 'linkedin_post',
          instagram: 'instagram_post',
          facebook: 'facebook_post',
          tiktok: 'tiktok_video',
          youtube: 'youtube_video',
          threads: 'threads_post',
        };

        // Build full content for library (including thread if applicable)
        let libraryContent = content;
        if (threadItems && threadItems.length > 0) {
          libraryContent = threadItems.map(t => t.text).join('\n\n---\n\n');
        }

        await supabase
          .from("client_content_library")
          .insert({
            client_id: clientId,
            title: libraryContent.substring(0, 100),
            content: libraryContent,
            content_type: contentTypeMap[platform] || 'post',
            content_url: publishedUrl,
            metadata: {
              platform,
              posted_at: new Date().toISOString(),
              late_post_id: postData.post?._id,
              is_thread: threadItems && threadItems.length > 1,
              thread_count: threadItems?.length,
            },
          });

        // Mark planning item as added to library
        await supabase
          .from("planning_items")
          .update({ added_to_library: true })
          .eq("id", planningItemId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      postId: postData.post?._id || postData.postId,
      status: newStatus,
      url: publishedUrl,
      platform,
      message: publishNow 
        ? `Publicado em ${platform}!` 
        : `Agendado para ${new Date(scheduledFor!).toLocaleString('pt-BR')}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro em late-post:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
