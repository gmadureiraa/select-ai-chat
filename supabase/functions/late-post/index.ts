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

// Allowed platforms enum for validation
const ALLOWED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads'] as const;
type AllowedPlatform = typeof ALLOWED_PLATFORMS[number];

type IGContentType = 'feed' | 'story' | 'reel' | 'carousel';
type FBContentType = 'feed' | 'story' | 'reel';
type TrialReelMode = 'off' | 'manual' | 'auto';

interface InstagramOptions {
  contentType?: IGContentType;
  shareToFeed?: boolean;
  trialReel?: TrialReelMode;
  collaborators?: string[];
  userTags?: Array<{ username: string; x: number; y: number; mediaIndex?: number }>;
  firstComment?: string;
  instagramThumbnail?: string;
  thumbOffset?: number;
  audioName?: string;
  customCaption?: string;
}

interface FacebookOptions {
  contentType?: FBContentType;
  firstComment?: string;
  customCaption?: string;
}

interface PlatformOptions {
  instagram?: InstagramOptions;
  facebook?: FacebookOptions;
  // future: linkedin, tiktok, youtube, threads, twitter
  [key: string]: Record<string, unknown> | undefined;
}

interface PostRequest {
  clientId: string;
  platform: AllowedPlatform;
  content: string;
  mediaUrls?: string[];
  mediaItems?: MediaItem[];
  threadItems?: ThreadItem[]; // For native thread support
  planningItemId?: string;
  scheduledFor?: string; // ISO date string for scheduling
  publishNow?: boolean;
  platformOptions?: PlatformOptions;
}

// Input validation constants
const MAX_CONTENT_LENGTH = 50000;
const MAX_MEDIA_ITEMS = 10;
const MAX_THREAD_ITEMS = 25;

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
    
    // Check if this is an internal service call (from cron/other edge functions)
    const isServiceRole = authHeader === `Bearer ${supabaseServiceRoleKey}`;
    
    if (!isServiceRole) {
      // For user requests, verify the JWT token
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !user) {
        console.error("Auth error:", userError);
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[late-post] Authenticated user: ${user.id}`);
    } else {
      console.log("[late-post] Internal service role call");
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      clientId,
      platform,
      content: rawContent,
      mediaUrls,
      mediaItems: inputMediaItems,
      threadItems,
      planningItemId,
      scheduledFor,
      publishNow = true,
      platformOptions,
    }: PostRequest = await req.json();

    // Resolve per-platform options + caption override
    const igOpts: InstagramOptions = platformOptions?.instagram || {};
    const fbOpts: FacebookOptions = platformOptions?.facebook || {};
    let content = rawContent;
    if (platform === 'instagram' && igOpts.customCaption?.trim()) {
      content = igOpts.customCaption;
    } else if (platform === 'facebook' && fbOpts.customCaption?.trim()) {
      content = fbOpts.customCaption;
    }

    // === INPUT VALIDATION ===
    
    // Required fields
    if (!clientId || !platform) {
      return new Response(JSON.stringify({ error: "Cliente e plataforma são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate clientId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return new Response(JSON.stringify({ error: "ID do cliente inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate platform is one of allowed values
    if (!ALLOWED_PLATFORMS.includes(platform as AllowedPlatform)) {
      return new Response(JSON.stringify({ 
        error: `Plataforma inválida. Permitidas: ${ALLOWED_PLATFORMS.join(', ')}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate content length
    if (content && content.length > MAX_CONTENT_LENGTH) {
      return new Response(JSON.stringify({ 
        error: `Conteúdo muito longo (max ${MAX_CONTENT_LENGTH} caracteres)` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate media URL count
    if (mediaUrls && mediaUrls.length > MAX_MEDIA_ITEMS) {
      return new Response(JSON.stringify({ 
        error: `Máximo de ${MAX_MEDIA_ITEMS} mídias por post` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate mediaItems count
    if (inputMediaItems && inputMediaItems.length > MAX_MEDIA_ITEMS) {
      return new Response(JSON.stringify({ 
        error: `Máximo de ${MAX_MEDIA_ITEMS} mídias por post` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate thread items count
    if (threadItems && threadItems.length > MAX_THREAD_ITEMS) {
      return new Response(JSON.stringify({ 
        error: `Máximo de ${MAX_THREAD_ITEMS} itens na thread` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate planningItemId if provided
    if (planningItemId && !uuidRegex.test(planningItemId)) {
      return new Response(JSON.stringify({ error: "ID do item de planejamento inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate scheduledFor if provided
    if (scheduledFor) {
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        return new Response(JSON.stringify({ error: "Data de agendamento inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === END INPUT VALIDATION ===

    // Content validation
    const hasContent = content?.trim();
    const hasThreadItems = threadItems && threadItems.length > 0 && threadItems.some(t => t.text?.trim());
    
    if (!hasContent && !hasThreadItems) {
      return new Response(JSON.stringify({ error: "Conteúdo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === THREADS PLATFORM: 500 char limit enforcement ===
    const THREADS_MAX_CHARS = 500;
    let finalContent = content;
    
    if (platform === 'threads' && finalContent && finalContent.length > THREADS_MAX_CHARS) {
      console.warn(`[late-post] Threads content too long (${finalContent.length} chars), truncating to ${THREADS_MAX_CHARS}`);
      finalContent = finalContent.substring(0, THREADS_MAX_CHARS - 3) + '...';
    }
    
    // Truncate thread items for Threads platform
    if (platform === 'threads' && threadItems) {
      for (const item of threadItems) {
        if (item.text && item.text.length > THREADS_MAX_CHARS) {
          console.warn(`[late-post] Threads thread item too long (${item.text.length} chars), truncating`);
          item.text = item.text.substring(0, THREADS_MAX_CHARS - 3) + '...';
        }
      }
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
    const credentialProfileId = metadata?.late_profile_id as string | undefined;

    // SECURITY: Verify this account belongs to this client's profile
    // Fetch the client's Late profile to validate
    const { data: clientProfile } = await supabase
      .from("client_social_credentials")
      .select("metadata, account_id")
      .eq("client_id", clientId)
      .eq("platform", "late_profile")
      .single();

    const clientProfileId = (clientProfile?.metadata as Record<string, unknown>)?.late_profile_id || clientProfile?.account_id;

    if (credentialProfileId && clientProfileId && credentialProfileId !== clientProfileId) {
      console.error("SECURITY: Account profile mismatch!", { 
        clientId, 
        platform, 
        credentialProfileId, 
        clientProfileId 
      });
      return new Response(JSON.stringify({ 
        error: "Esta conta não pertence a este cliente. Reconecte a conta nas Integrações." 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Publicando com credenciais:", { 
      clientId, 
      platform, 
      accountId: credentials.account_id,
      lateAccountId,
      accountName: credentials.account_name,
      profileId: credentialProfileId,
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

    // Build media items array - IMPORTANT: Preserve order for carousels
    let finalMediaItems: Array<{ type: string; url: string; order?: number }> = [];
    
    if (inputMediaItems && inputMediaItems.length > 0) {
      // Use index to preserve order - critical for Instagram carousels
      finalMediaItems = inputMediaItems.map((m, index) => ({
        type: m.type || (m.url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
        url: m.url,
        order: index,
      }));
    } else if (mediaUrls && mediaUrls.length > 0) {
      finalMediaItems = mediaUrls.map((url, index) => ({
        type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
        url: url,
        order: index,
      }));
    }

    console.log("Media items with order:", finalMediaItems.map(m => ({ url: m.url.substring(0, 50), order: m.order })));

    // Use finalContent (possibly truncated for Threads) instead of raw content
    const postContent = platform === 'threads' ? (finalContent || content) : content;

    // Build post payload for Late API
    const postPayload: Record<string, unknown> = {
      publishNow: publishNow,
    };

    // Handle threads (for Twitter/X and Threads)
    if (threadItems && threadItems.length > 0 && (platform === 'twitter' || platform === 'threads')) {
      // Build ALL thread items - Late API expects every tweet in threadItems
      const lateThreadItems = threadItems.map((item, index) => {
        const threadItem: Record<string, unknown> = {
          content: item.text,
          order: index, // Preserve thread order
        };
        
        // Add media to thread item if present - preserve order
        if (item.media_urls && item.media_urls.length > 0) {
          threadItem.mediaItems = item.media_urls.map((url, mediaIndex) => ({
            type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
            url: url,
            order: mediaIndex,
          }));
        }
        
        return threadItem;
      });

      console.log("Building thread with items:", lateThreadItems.length);

      // IMPORTANT: Late API expects ALL tweets in threadItems, including the first one
      // Do NOT set content separately - Late API uses first item from threadItems
      postPayload.platforms = [{
        platform: platform,
        accountId: lateAccountId,
        platformSpecificData: {
          threadItems: lateThreadItems, // ALL tweets here, including the first
        }
      }];

      // Set content to first tweet for backwards compatibility, but Late uses threadItems
      postPayload.content = lateThreadItems[0]?.content || content;
    } else {
      // Standard post (non-thread) - use postContent (truncated for Threads)
      postPayload.content = postContent;
      
      // Build platform-specific data
      const platformSpecificData: Record<string, unknown> = {};
      
      // TikTok specific data
      if (platform === 'tiktok') {
        platformSpecificData.privacy_level = 'PUBLIC_TO_EVERYONE';
        // TikTok uses title separately from content for video description
        if (content.length > 150) {
          platformSpecificData.title = content.substring(0, 147) + '...';
        }
      }
      
      // YouTube specific data
      if (platform === 'youtube') {
        platformSpecificData.visibility = 'public';
        // First line as title, rest as description
        const lines = content.split('\n');
        platformSpecificData.title = lines[0]?.substring(0, 100) || 'Untitled';
        if (lines.length > 1) {
          platformSpecificData.description = lines.slice(1).join('\n');
        }
      }
      
      // === Instagram advanced options (Stories, Reels, Trial Reels, etc.) ===
      if (platform === 'instagram') {
        const desiredType: IGContentType = igOpts.contentType
          || (finalMediaItems.length > 1 ? 'carousel' : 'feed');

        if (desiredType === 'story') {
          platformSpecificData.contentType = 'story';
          if (finalMediaItems.length > 1) {
            return new Response(JSON.stringify({
              error: "Stories aceitam apenas 1 mídia. Reduza para 1 imagem/vídeo."
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else if (desiredType === 'reel') {
          platformSpecificData.contentType = 'reels';
          if (igOpts.shareToFeed === false) platformSpecificData.shareToFeed = false;
          else platformSpecificData.shareToFeed = true;

          // Trial Reels (only for Reels)
          if (igOpts.trialReel && igOpts.trialReel !== 'off') {
            platformSpecificData.trialParams = {
              graduationStrategy: igOpts.trialReel === 'auto' ? 'SS_PERFORMANCE' : 'MANUAL',
            };
          }

          // Reel thumbnail / audio
          if (igOpts.instagramThumbnail) platformSpecificData.instagramThumbnail = igOpts.instagramThumbnail;
          else if (typeof igOpts.thumbOffset === 'number') platformSpecificData.thumbOffset = igOpts.thumbOffset;
          if (igOpts.audioName) platformSpecificData.audioName = igOpts.audioName;

          // Validate media is a video
          const firstMedia = finalMediaItems[0];
          if (!firstMedia || firstMedia.type !== 'video') {
            return new Response(JSON.stringify({
              error: "Reels exigem um vídeo (9:16, até 90s)."
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else if (desiredType === 'carousel' || finalMediaItems.length > 1) {
          console.log("Instagram carousel detected with", finalMediaItems.length, "items");
          platformSpecificData.isCarousel = true;
        }
        // 'feed' = no contentType field

        // Common Instagram fields (apply to feed/reel/carousel; not stories)
        if (desiredType !== 'story') {
          if (igOpts.collaborators?.length) {
            platformSpecificData.collaborators = igOpts.collaborators
              .map(u => u.replace(/^@/, '').trim())
              .filter(Boolean)
              .slice(0, 3);
          }
          if (igOpts.firstComment?.trim()) {
            platformSpecificData.firstComment = igOpts.firstComment.trim();
          }
          if (igOpts.userTags?.length) {
            platformSpecificData.userTags = igOpts.userTags;
          }
        }
      }

      // === Facebook content type (story / reel / feed) ===
      if (platform === 'facebook') {
        if (fbOpts.contentType === 'story') platformSpecificData.contentType = 'story';
        else if (fbOpts.contentType === 'reel') platformSpecificData.contentType = 'reels';
        if (fbOpts.firstComment?.trim()) platformSpecificData.firstComment = fbOpts.firstComment.trim();
      }
      
      postPayload.platforms = [{
        platform: platform,
        accountId: lateAccountId,
        ...(Object.keys(platformSpecificData).length > 0 && { platformSpecificData }),
      }];

      if (finalMediaItems.length > 0) {
        // Sort by order to ensure correct sequence
        const sortedMedia = [...finalMediaItems].sort((a, b) => (a.order || 0) - (b.order || 0));
        postPayload.mediaItems = sortedMedia.map(({ type, url }) => ({ type, url }));
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
      let responseStatus = 500;
      try {
        const errorJson = JSON.parse(responseText);
        if (postResponse.status === 409) {
          userMessage = "Este conteúdo já foi publicado ou agendado para esta conta nas últimas 24 horas. Altere o texto para publicar novamente.";
          responseStatus = 409;
        } else if (errorJson.message) {
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
        } else if (responseText.includes("2207052")) {
          userMessage = "Threads: erro ao processar mídia. Verifique se a imagem/vídeo é acessível.";
        } else if (responseText.includes("2207050")) {
          userMessage = "Threads: conta restrita. Verifique as permissões da conta.";
        } else if (responseText.includes("character") || responseText.includes("too long")) {
          userMessage = "Threads: conteúdo excede o limite de 500 caracteres.";
          userMessage = "Credenciais expiradas. Reconecte a conta.";
        }
      }

      return new Response(JSON.stringify({ 
        error: userMessage,
        details: responseText 
      }), {
        status: responseStatus,
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
      // Get current item to merge metadata and get workspace_id
      const { data: currentItem } = await supabase
        .from("planning_items")
        .select("metadata, workspace_id, added_to_library")
        .eq("id", planningItemId)
        .single();

      const existingMetadata = (currentItem?.metadata as Record<string, unknown>) || {};
      const publishedPlatforms: string[] = (existingMetadata.published_platforms as string[]) || [];
      const latePostIds: Record<string, string> = (existingMetadata.late_post_ids as Record<string, string>) || {};
      const publishedUrls: Record<string, string> = (existingMetadata.published_urls as Record<string, string>) || {};

      // Track this platform's publish
      if (!publishedPlatforms.includes(platform)) {
        publishedPlatforms.push(platform);
      }
      const postId = postData.post?._id || postData.postId;
      if (postId) {
        latePostIds[platform] = postId;
      }
      if (publishedUrl) {
        publishedUrls[platform] = publishedUrl;
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
        error_message: null,
        updated_at: new Date().toISOString(),
        external_post_id: postId,
        metadata: {
          ...existingMetadata,
          published_platforms: publishedPlatforms,
          late_post_ids: latePostIds,
          published_urls: publishedUrls,
          published_url: publishedUrl, // Last published URL for backwards compat
          late_post_id: postId,
          late_confirmed: !publishNow,
        },
      };

      if (publishNow) {
        updateData.published_at = new Date().toISOString();
      }

      if (scheduledFor) {
        updateData.scheduled_at = scheduledFor;
      }

      // If published, move to "published" column
      if (publishNow && currentItem?.workspace_id) {
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

      await supabase
        .from("planning_items")
        .update(updateData)
        .eq("id", planningItemId);

      // Save to content library if published (only once per planning item)
      if (publishNow && !currentItem?.added_to_library) {
        const contentTypeMap: Record<string, string> = {
          twitter: 'tweet',
          linkedin: 'linkedin_post',
          instagram: 'instagram_post',
          facebook: 'facebook_post',
          tiktok: 'tiktok_video',
          youtube: 'youtube_video',
          threads: 'threads_post',
        };

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
              all_platforms: publishedPlatforms,
              posted_at: new Date().toISOString(),
              late_post_id: postId,
              is_thread: threadItems && threadItems.length > 1,
              thread_count: threadItems?.length,
            },
          });

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
