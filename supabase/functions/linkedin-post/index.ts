import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostRequest {
  scheduledPostId: string;
}

async function uploadImageToLinkedIn(
  imageUrl: string,
  accessToken: string,
  personUrn: string
): Promise<string | null> {
  try {
    // Step 1: Register upload
    const registerResponse = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: personUrn,
          serviceRelationships: [{
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent"
          }]
        }
      }),
    });

    if (!registerResponse.ok) {
      console.error("LinkedIn register upload failed:", await registerResponse.text());
      return null;
    }

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
      console.error("LinkedIn upload URL not found");
      return null;
    }

    // Step 2: Download and upload image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      console.error("LinkedIn image upload failed:", await uploadResponse.text());
      return null;
    }

    return asset;
  } catch (error) {
    console.error("Error uploading to LinkedIn:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { scheduledPostId } = await req.json() as PostRequest;

    console.log(`Processing LinkedIn post for scheduled_post: ${scheduledPostId}`);

    // Get the scheduled post
    const { data: post, error: postError } = await supabaseClient
      .from('scheduled_posts')
      .select('*')
      .eq('id', scheduledPostId)
      .single();

    if (postError || !post) {
      throw new Error(`Post não encontrado: ${postError?.message}`);
    }

    // Update status to publishing
    await supabaseClient
      .from('scheduled_posts')
      .update({ status: 'publishing' })
      .eq('id', scheduledPostId);

    // Get credentials for this client
    const { data: credentials, error: credError } = await supabaseClient
      .from('client_social_credentials')
      .select('*')
      .eq('client_id', post.client_id)
      .eq('platform', 'linkedin')
      .single();

    if (credError || !credentials) {
      throw new Error('Credenciais do LinkedIn não configuradas para este cliente');
    }

    if (!credentials.is_valid) {
      throw new Error(`Credenciais do LinkedIn inválidas: ${credentials.validation_error || 'Revalide as credenciais'}`);
    }

    const accessToken = credentials.oauth_access_token;
    const personUrn = `urn:li:person:${credentials.account_id}`;

    // Upload media if present
    let mediaAssets: string[] = [];
    const mediaUrls = post.media_urls || [];
    
    for (const imageUrl of mediaUrls.slice(0, 9)) { // LinkedIn allows up to 9 images
      const asset = await uploadImageToLinkedIn(imageUrl, accessToken, personUrn);
      if (asset) {
        mediaAssets.push(asset);
      }
    }

    // Create post payload
    const postPayload: any = {
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: post.content
          },
          shareMediaCategory: mediaAssets.length > 0 ? "IMAGE" : "NONE",
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };

    if (mediaAssets.length > 0) {
      postPayload.specificContent["com.linkedin.ugc.ShareContent"].media = mediaAssets.map(asset => ({
        status: "READY",
        media: asset,
      }));
    }

    // Post to LinkedIn
    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postPayload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      const errorMessage = responseData.message || responseData.raw || 'Erro ao publicar no LinkedIn';
      console.error("LinkedIn post error:", responseData);
      
      // Update post with error
      await supabaseClient
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: errorMessage,
          retry_count: (post.retry_count || 0) + 1,
        })
        .eq('id', scheduledPostId);

      throw new Error(errorMessage);
    }

    const postId = response.headers.get('x-restli-id') || responseData.id;

    // Success - update post
    await supabaseClient
      .from('scheduled_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: postId,
        error_message: null,
      })
      .eq('id', scheduledPostId);

    // Update kanban card if linked
    const { data: kanbanCard } = await supabaseClient
      .from('kanban_cards')
      .select('id, column_id')
      .eq('scheduled_post_id', scheduledPostId)
      .single();

    if (kanbanCard) {
      const { data: columns } = await supabaseClient
        .from('kanban_columns')
        .select('id, workspace_id')
        .eq('column_type', 'published');

      if (columns && columns.length > 0) {
        const { data: currentColumn } = await supabaseClient
          .from('kanban_columns')
          .select('workspace_id')
          .eq('id', kanbanCard.column_id)
          .single();

        if (currentColumn) {
          const publishedColumn = columns.find(c => c.workspace_id === currentColumn.workspace_id);
          if (publishedColumn) {
            await supabaseClient
              .from('kanban_cards')
              .update({ column_id: publishedColumn.id })
              .eq('id', kanbanCard.id);
          }
        }
      }
    }

    console.log(`LinkedIn post published successfully: ${postId}`);

    return new Response(JSON.stringify({
      success: true,
      postId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("LinkedIn post error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false, 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
