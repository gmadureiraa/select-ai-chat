import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncResult {
  total: number;
  created: number;
  updated: number;
  transcribed: number;
  errors: number;
  items: Array<{
    id: string;
    title: string;
    status: "created" | "updated" | "skipped" | "error";
    hasTranscript?: boolean;
    error?: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      clientId, 
      platform, // "youtube" | "newsletter"
      rssUrl,
      channelId, // for YouTube
      mode = "only_missing", // "only_missing" | "backfill"
      forceRetranscribe = false,
      limit = 20
    } = await req.json();

    if (!clientId || !platform) {
      return new Response(
        JSON.stringify({ error: "clientId and platform are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Syncing ${platform} RSS to library for client ${clientId}`);
    console.log(`Mode: ${mode}, forceRetranscribe: ${forceRetranscribe}, limit: ${limit}`);

    const result: SyncResult = {
      total: 0,
      created: 0,
      updated: 0,
      transcribed: 0,
      errors: 0,
      items: [],
    };

    if (platform === "youtube") {
      await syncYouTubeToLibrary(supabase, clientId, channelId, rssUrl, mode, forceRetranscribe, limit, result, authHeader);
    } else if (platform === "newsletter") {
      await syncNewsletterToLibrary(supabase, clientId, rssUrl, mode, limit, result);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown platform: ${platform}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Sync complete: ${result.created} created, ${result.updated} updated, ${result.transcribed} transcribed, ${result.errors} errors`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function syncYouTubeToLibrary(
  supabase: any,
  clientId: string,
  channelId: string | undefined,
  rssUrl: string | undefined,
  mode: string,
  forceRetranscribe: boolean,
  limit: number,
  result: SyncResult,
  authHeader: string
) {
  // Build RSS URL if not provided
  let feedUrl = rssUrl;
  if (!feedUrl && channelId) {
    feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  }

  if (!feedUrl) {
    // Try to get from client's social_media
    const { data: clientData } = await supabase
      .from("clients")
      .select("social_media")
      .eq("id", clientId)
      .single();

    const socialMedia = clientData?.social_media as Record<string, any> | null;
    const savedChannelId = socialMedia?.youtube_channel_id;
    
    if (savedChannelId) {
      feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${savedChannelId}`;
    } else {
      throw new Error("No YouTube channel configured for this client");
    }
  }

  console.log(`📡 Fetching YouTube RSS: ${feedUrl}`);

  // Fetch RSS feed
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Kaleidos/1.0)",
      "Accept": "application/atom+xml, application/xml, text/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube RSS: ${response.status}`);
  }

  const xml = await response.text();
  const items = parseAtomFeed(xml);
  result.total = items.length;

  console.log(`📦 Found ${items.length} videos in feed`);

  // Get existing library entries for this client + youtube
  const { data: existingLibrary } = await supabase
    .from("client_content_library")
    .select("id, content_url, content, metadata")
    .eq("client_id", clientId)
    .eq("content_type", "video_script");

  const existingByUrl = new Map<string, any>();
  for (const entry of existingLibrary || []) {
    if (entry.content_url) {
      existingByUrl.set(entry.content_url, entry);
    }
  }

  // Process each video
  const itemsToProcess = items.slice(0, limit);
  
  for (const item of itemsToProcess) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
      const existing = existingByUrl.get(videoUrl);

      // Skip if exists and mode is only_missing (unless forceRetranscribe)
      if (existing && mode === "only_missing" && !forceRetranscribe) {
        result.items.push({
          id: item.videoId,
          title: item.title,
          status: "skipped",
          hasTranscript: !!existing.content && existing.content.length > 100,
        });
        continue;
      }

      // Need to transcribe if: new, or forceRetranscribe, or no transcript
      const needsTranscript = !existing || forceRetranscribe || !existing.content || existing.content.length < 100;

      let transcript = "";
      let hasTranscript = false;

      if (needsTranscript) {
        console.log(`📝 Transcribing video: ${item.title}`);
        try {
          // Call extract-youtube function
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-youtube`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader,
            },
            body: JSON.stringify({ url: videoUrl }),
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            transcript = extractData.content || extractData.transcript || "";
            hasTranscript = transcript.length > 0;
            if (hasTranscript) {
              result.transcribed++;
            }
          }
        } catch (transcriptErr) {
          console.warn(`⚠️ Transcript failed for ${item.videoId}:`, transcriptErr);
        }
      } else {
        transcript = existing.content;
        hasTranscript = true;
      }

      // Upsert to library
      const libraryData = {
        client_id: clientId,
        title: item.title,
        content: transcript || `Vídeo: ${item.title}`,
        content_type: "video_script" as const,
        content_url: videoUrl,
        thumbnail_url: item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
        metadata: {
          video_id: item.videoId,
          published_at: item.published,
          description: item.description,
          has_transcript: hasTranscript,
          synced_from_rss: true,
          source: "rss_sync",
        },
      };

      if (existing) {
        // Update
        const { error: updateError } = await supabase
          .from("client_content_library")
          .update({
            ...libraryData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
        result.updated++;
        result.items.push({ id: item.videoId, title: item.title, status: "updated", hasTranscript });
      } else {
        // Insert
        const { data: insertedLibrary, error: insertError } = await supabase
          .from("client_content_library")
          .insert(libraryData)
          .select("id")
          .single();

        if (insertError) throw insertError;
        result.created++;

        // Also update youtube_videos if exists
        await supabase
          .from("youtube_videos")
          .update({
            transcript: transcript || null,
            content_synced_at: new Date().toISOString(),
            content_library_id: insertedLibrary.id,
          })
          .eq("client_id", clientId)
          .eq("video_id", item.videoId);

        result.items.push({ id: item.videoId, title: item.title, status: "created", hasTranscript });
      }
    } catch (itemError) {
      console.error(`❌ Error processing video ${item.videoId}:`, itemError);
      result.errors++;
      result.items.push({
        id: item.videoId,
        title: item.title,
        status: "error",
        error: itemError instanceof Error ? itemError.message : "Unknown error",
      });
    }
  }
}

async function syncNewsletterToLibrary(
  supabase: any,
  clientId: string,
  rssUrl: string | undefined,
  mode: string,
  limit: number,
  result: SyncResult
) {
  let feedUrl = rssUrl;

  if (!feedUrl) {
    // Try to get from client's social_media
    const { data: clientData } = await supabase
      .from("clients")
      .select("social_media")
      .eq("id", clientId)
      .single();

    const socialMedia = clientData?.social_media as Record<string, any> | null;
    feedUrl = socialMedia?.newsletter_rss;

    if (!feedUrl) {
      throw new Error("No newsletter RSS configured for this client");
    }
  }

  console.log(`📡 Fetching Newsletter RSS: ${feedUrl}`);

  // Fetch RSS feed
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Kaleidos/1.0)",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Newsletter RSS: ${response.status}`);
  }

  const xml = await response.text();
  const items = parseRSSFeed(xml);
  result.total = items.length;

  console.log(`📦 Found ${items.length} newsletter editions in feed`);

  // Get existing library entries for this client + newsletter
  const { data: existingLibrary } = await supabase
    .from("client_content_library")
    .select("id, content_url, metadata")
    .eq("client_id", clientId)
    .eq("content_type", "newsletter");

  const existingByUrl = new Map<string, any>();
  for (const entry of existingLibrary || []) {
    if (entry.content_url) {
      existingByUrl.set(entry.content_url, entry);
    }
    // Also check by guid in metadata
    const guid = entry.metadata?.rss_guid;
    if (guid) {
      existingByUrl.set(guid, entry);
    }
  }

  // Process each newsletter
  const itemsToProcess = items.slice(0, limit);

  for (const item of itemsToProcess) {
    try {
      const existing = existingByUrl.get(item.link) || existingByUrl.get(item.guid);

      // Skip if exists and mode is only_missing
      if (existing && mode === "only_missing") {
        result.items.push({
          id: item.guid,
          title: item.title,
          status: "skipped",
        });
        continue;
      }

      // Find thumbnail from images or first img in content
      const thumbnail = item.imageUrl || item.allImages?.[0] || null;

      const libraryData = {
        client_id: clientId,
        title: item.title,
        content: item.content || item.description || `Newsletter: ${item.title}`,
        content_type: "newsletter" as const,
        content_url: item.link || null,
        thumbnail_url: thumbnail,
        metadata: {
          rss_guid: item.guid,
          pub_date: item.pubDate,
          description: item.description,
          all_images: item.allImages,
          synced_from_rss: true,
          source: "rss_sync",
        },
      };

      if (existing) {
        // Update
        const { error: updateError } = await supabase
          .from("client_content_library")
          .update({
            ...libraryData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
        result.updated++;
        result.items.push({ id: item.guid, title: item.title, status: "updated" });
      } else {
        // Insert
        const { data: insertedLibrary, error: insertError } = await supabase
          .from("client_content_library")
          .insert(libraryData)
          .select("id")
          .single();

        if (insertError) throw insertError;
        result.created++;

        // Try to link with platform_metrics if exists
        const metricDate = item.pubDate ? new Date(item.pubDate).toISOString().split("T")[0] : null;
        if (metricDate) {
          await supabase
            .from("platform_metrics")
            .update({ content_library_id: insertedLibrary.id })
            .eq("client_id", clientId)
            .eq("platform", "newsletter")
            .eq("metric_date", metricDate);
        }

        result.items.push({ id: item.guid, title: item.title, status: "created" });
      }
    } catch (itemError) {
      console.error(`❌ Error processing newsletter ${item.guid}:`, itemError);
      result.errors++;
      result.items.push({
        id: item.guid,
        title: item.title,
        status: "error",
        error: itemError instanceof Error ? itemError.message : "Unknown error",
      });
    }
  }
}

// Parse YouTube Atom feed
function parseAtomFeed(xml: string): Array<{
  videoId: string;
  title: string;
  published: string;
  description: string;
  thumbnail: string;
}> {
  const items: Array<{
    videoId: string;
    title: string;
    published: string;
    description: string;
    thumbnail: string;
  }> = [];

  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const entryXml of entryMatches) {
    const videoId = entryXml.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i)?.[1]?.trim() || "";
    const title = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
    const published = entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() || "";
    const description = entryXml.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i)?.[1]?.trim() || "";
    const thumbnail = entryXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] || "";

    if (videoId) {
      items.push({
        videoId,
        title: decodeHtmlEntities(title),
        published,
        description: decodeHtmlEntities(description),
        thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
  }

  return items;
}

// Parse standard RSS feed
function parseRSSFeed(xml: string): Array<{
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content: string;
  imageUrl?: string;
  allImages?: string[];
}> {
  const items: Array<{
    guid: string;
    title: string;
    link: string;
    description: string;
    pubDate: string;
    content: string;
    imageUrl?: string;
    allImages?: string[];
  }> = [];

  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";
    const link = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || "";
    const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || "";
    const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || "";
    const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;
    const contentEncoded = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim() || "";

    // Extract images
    const allImages: string[] = [];
    const rawContent = contentEncoded || description;
    const imgMatches = rawContent.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      if (match[1] && !allImages.includes(match[1])) {
        allImages.push(match[1]);
      }
    }

    // Also check media:content
    const mediaContent = itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i)?.[1];
    if (mediaContent && !allImages.includes(mediaContent)) {
      allImages.unshift(mediaContent);
    }

    // Convert content to clean text/markdown
    const cleanContent = (contentEncoded || description)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, "\n\n![$2]($1)\n\n")
      .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, "\n\n![$1]($2)\n\n")
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "\n\n![]($1)\n\n")
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n")
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n")
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "\n\n> $1\n\n")
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "  \n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/?[ou]l[^>]*>/gi, "\n")
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    items.push({
      guid,
      title: decodeHtmlEntities(title),
      link,
      description: decodeHtmlEntities(description.replace(/<[^>]+>/g, "").substring(0, 300)),
      pubDate,
      content: cleanContent,
      imageUrl: allImages[0],
      allImages,
    });
  }

  return items;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...");
}
