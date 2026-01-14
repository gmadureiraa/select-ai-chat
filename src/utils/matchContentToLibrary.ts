import { supabase } from "@/integrations/supabase/client";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { parseISO, differenceInDays } from "date-fns";

interface ContentLibraryItem {
  id: string;
  title: string;
  content: string;
  content_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

/**
 * Matches an Instagram post to content in the library based on:
 * 1. Permalink match
 * 2. Date + caption similarity
 */
export async function matchPostToLibrary(
  post: InstagramPost,
  clientId: string
): Promise<string | null> {
  try {
    // 1. Try exact permalink match
    if (post.permalink) {
      const { data: byPermalink } = await supabase
        .from("client_content_library")
        .select("id")
        .eq("client_id", clientId)
        .eq("content_url", post.permalink)
        .single();

      if (byPermalink) {
        return byPermalink.id;
      }
    }

    // 2. Try match by date + content similarity
    if (post.posted_at && post.caption) {
      const postDate = parseISO(post.posted_at);
      
      // Get library items from around the same date
      const { data: candidates } = await supabase
        .from("client_content_library")
        .select("id, title, content, content_url, metadata, created_at")
        .eq("client_id", clientId)
        .in("content_type", ["instagram_post", "carousel", "reel_script", "stories", "social_post"]);

      if (candidates && candidates.length > 0) {
        const match = findBestMatch(candidates as ContentLibraryItem[], post, postDate);
        if (match) return match;
      }
    }

    return null;
  } catch (error) {
    console.error("[matchPostToLibrary] Error:", error);
    return null;
  }
}

/**
 * Finds the best matching library item based on content similarity
 */
function findBestMatch(
  candidates: ContentLibraryItem[],
  post: InstagramPost,
  postDate: Date
): string | null {
  const postCaption = (post.caption || "").toLowerCase().trim();
  if (!postCaption) return null;

  let bestMatch: { id: string; score: number } | null = null;

  for (const candidate of candidates) {
    let score = 0;
    
    // Check date proximity if available
    if (candidate.created_at) {
      const candidateDate = parseISO(candidate.created_at);
      const daysDiff = Math.abs(differenceInDays(postDate, candidateDate));
      if (daysDiff <= 3) {
        score += 30 - (daysDiff * 10); // Closer dates = higher score
      }
    }

    // Check content similarity
    const candidateContent = (candidate.content || "").toLowerCase().trim();
    const candidateTitle = (candidate.title || "").toLowerCase().trim();

    // Exact content match
    if (candidateContent === postCaption || candidateTitle === postCaption) {
      score += 100;
    } else {
      // Partial match - check if one contains the other
      if (candidateContent.includes(postCaption) || postCaption.includes(candidateContent)) {
        score += 50;
      }
      
      // Check first 100 characters match
      const captionStart = postCaption.slice(0, 100);
      const contentStart = candidateContent.slice(0, 100);
      if (captionStart === contentStart) {
        score += 40;
      }

      // Word overlap score
      const captionWords = new Set(postCaption.split(/\s+/).filter(w => w.length > 3));
      const contentWords = new Set(candidateContent.split(/\s+/).filter(w => w.length > 3));
      const overlap = [...captionWords].filter(w => contentWords.has(w)).length;
      const overlapRatio = captionWords.size > 0 ? overlap / captionWords.size : 0;
      score += Math.round(overlapRatio * 30);
    }

    // Minimum threshold
    if (score > 60 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: candidate.id, score };
    }
  }

  return bestMatch?.id || null;
}

/**
 * Batch match posts to library and update the database
 */
export async function batchMatchPostsToLibrary(
  posts: InstagramPost[],
  clientId: string
): Promise<{ matched: number; total: number }> {
  let matched = 0;

  for (const post of posts) {
    // Skip if already linked
    if ((post as any).content_library_id) continue;

    const libraryId = await matchPostToLibrary(post, clientId);
    if (libraryId) {
      const { error } = await supabase
        .from("instagram_posts")
        .update({ content_library_id: libraryId })
        .eq("id", post.id);

      if (!error) {
        matched++;
      }
    }
  }

  return { matched, total: posts.length };
}

/**
 * Get library content for posts that are linked
 */
export async function getLinkedLibraryContent(
  postIds: string[]
): Promise<Map<string, ContentLibraryItem>> {
  const { data: posts } = await supabase
    .from("instagram_posts")
    .select("id, content_library_id")
    .in("id", postIds)
    .not("content_library_id", "is", null);

  if (!posts || posts.length === 0) {
    return new Map();
  }

  const libraryIds = posts.map(p => p.content_library_id).filter(Boolean) as string[];

  const { data: libraryItems } = await supabase
    .from("client_content_library")
    .select("id, title, content, content_url, metadata, created_at")
    .in("id", libraryIds);

  const result = new Map<string, ContentLibraryItem>();
  
  if (libraryItems) {
    // Map post ID to library item
    for (const post of posts) {
      const libraryItem = libraryItems.find(l => l.id === post.content_library_id);
      if (libraryItem) {
        result.set(post.id, libraryItem as ContentLibraryItem);
      }
    }
  }

  return result;
}
