import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Twitter config
const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")?.trim();
const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")?.trim();

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(method: string, url: string): string {
  const oauthParams = {
    oauth_consumer_key: TWITTER_CONSUMER_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    TWITTER_CONSUMER_SECRET!,
    TWITTER_ACCESS_TOKEN_SECRET!
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) => a[0].localeCompare(b[0]));
  return "OAuth " + entries.map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");
}

async function postToTwitter(content: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const url = "https://api.x.com/2/tweets";
    const oauthHeader = generateOAuthHeader("POST", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("Twitter error:", responseText);
      return { success: false, error: `Twitter API error: ${response.status}` };
    }

    const result = JSON.parse(responseText);
    return { success: true, postId: result.data?.id };
  } catch (error: any) {
    console.error("Twitter posting error:", error);
    return { success: false, error: error.message };
  }
}

async function postToLinkedIn(
  supabase: any,
  userId: string,
  content: string,
  imageUrl?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Get LinkedIn token for user
    const { data: tokenData, error: tokenError } = await supabase
      .from("linkedin_tokens")
      .select("access_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (tokenError || !tokenData) {
      return { success: false, error: "LinkedIn not connected" };
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return { success: false, error: "LinkedIn token expired" };
    }

    // Get user's LinkedIn URN
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { "Authorization": `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      return { success: false, error: "Failed to get LinkedIn profile" };
    }

    const profileData = await profileResponse.json();
    const personUrn = `urn:li:person:${profileData.sub}`;

    const postBody: any = {
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: imageUrl ? "IMAGE" : "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    // Handle image upload if provided
    if (imageUrl) {
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

        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();

        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${tokenData.access_token}` },
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

    if (!postResponse.ok) {
      console.error("LinkedIn API error:", responseText);
      return { success: false, error: `LinkedIn API error: ${postResponse.status}` };
    }

    const postResult = JSON.parse(responseText);
    return { success: true, postId: postResult.id };
  } catch (error: any) {
    console.error("LinkedIn posting error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate cron secret for security
    const providedSecret = req.headers.get("x-cron-secret");
    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      console.error("Unauthorized cron request - invalid or missing secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    console.log(`[${now}] Processing scheduled posts...`);

    // Get all scheduled posts that are due
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (fetchError) {
      throw fetchError;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      console.log("No scheduled posts to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${scheduledPosts.length} posts to process`);

    let processed = 0;
    const results: any[] = [];

    for (const post of scheduledPosts) {
      const publishResults: any = {};

      for (const platform of post.platforms) {
        if (platform === 'twitter') {
          const result = await postToTwitter(post.content);
          publishResults.twitter = result;
        } else if (platform === 'linkedin') {
          const result = await postToLinkedIn(supabase, post.user_id, post.content, post.image_url);
          publishResults.linkedin = result;
        }
      }

      // Update post status
      const allSuccess = Object.values(publishResults).every((r: any) => r.success);
      const { error: updateError } = await supabase
        .from('scheduled_posts')
        .update({
          status: allSuccess ? 'published' : 'failed',
          published_at: allSuccess ? now : null,
          publish_results: publishResults,
        })
        .eq('id', post.id);

      if (updateError) {
        console.error(`Error updating post ${post.id}:`, updateError);
      } else {
        processed++;
        results.push({ postId: post.id, results: publishResults });
      }
    }

    console.log(`Processed ${processed} posts`);

    return new Response(JSON.stringify({ processed, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error processing scheduled posts:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});