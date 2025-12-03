import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    // Get user from token
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    // Get LinkedIn token for user
    const { data: tokenData, error: tokenError } = await supabase
      .from("linkedin_tokens")
      .select("access_token, expires_at")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error("LinkedIn not connected. Please connect your LinkedIn account first.");
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      throw new Error("LinkedIn token expired. Please reconnect your account.");
    }

    const { content, imageUrl } = await req.json();

    if (!content) {
      throw new Error("Content is required");
    }

    console.log("Posting to LinkedIn for user:", user.id);

    // First, get the user's LinkedIn URN
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const profileError = await profileResponse.text();
      console.error("LinkedIn profile error:", profileError);
      throw new Error("Failed to get LinkedIn profile");
    }

    const profileData = await profileResponse.json();
    const personUrn = `urn:li:person:${profileData.sub}`;
    console.log("LinkedIn person URN:", personUrn);

    // Create the post
    const postBody: any = {
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: imageUrl ? "IMAGE" : "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    // If there's an image, we need to upload it first
    if (imageUrl) {
      // Register upload
      const registerResponse = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: personUrn,
            serviceRelationships: [{
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            }],
          },
        }),
      });

      if (registerResponse.ok) {
        const registerData = await registerResponse.json();
        const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
        const asset = registerData.value.asset;

        // Download image and upload to LinkedIn
        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();

        await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${tokenData.access_token}`,
          },
          body: imageBlob,
        });

        postBody.specificContent["com.linkedin.ugc.ShareContent"].media = [{
          status: "READY",
          media: asset,
        }];
      }
    }

    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postBody),
    });

    const responseText = await postResponse.text();
    console.log("LinkedIn post response status:", postResponse.status);

    if (!postResponse.ok) {
      console.error("LinkedIn API error:", responseText);
      throw new Error(`LinkedIn API error: ${postResponse.status} - ${responseText}`);
    }

    const postResult = JSON.parse(responseText);

    return new Response(JSON.stringify({
      success: true,
      platform: "linkedin",
      postId: postResult.id,
      message: "Post publicado no LinkedIn com sucesso!",
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error posting to LinkedIn:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
