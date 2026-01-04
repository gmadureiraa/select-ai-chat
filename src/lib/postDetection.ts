import { PostPlatform } from "@/components/posts";
import { CarouselSlide } from "@/components/posts/CarouselEditor";

export interface DetectedPost {
  platform: PostPlatform;
  content: string;
}

export interface DetectedCarousel {
  slides: CarouselSlide[];
}

export interface ThreadTweet {
  id: string;
  text: string;
  media_urls: string[];
}

export interface ParsedThread {
  tweets: ThreadTweet[];
}

// Patterns to detect social media posts
const platformPatterns: Record<PostPlatform, RegExp[]> = {
  twitter: [
    /^tweet\s*:/im,
    /twitter\s*:/i,
    /para\s+o?\s*(twitter|x)\s*:/i,
    /post\s+no\s+(twitter|x)/i,
    /---\s*TWEET\s*---/i,
    /thread\s*(para|de|no)?\s*(twitter|x)?/i,
  ],
  instagram: [
    /instagram\s*:/i,
    /caption\s*:/i,
    /legenda\s*(instagram)?\s*:/i,
    /para\s+o?\s*instagram\s*:/i,
    /post\s+no\s+instagram/i,
    /carrossel/i,
  ],
  linkedin: [
    /linkedin\s*:/i,
    /para\s+o?\s*linkedin\s*:/i,
    /post\s+no\s+linkedin/i,
    /---\s*LINKEDIN\s*---/i,
  ],
};

// Check if content looks like a short tweet (<=280 chars, single block)
function isLikelyTweet(content: string): boolean {
  const cleanContent = content.trim();
  // If it's short, doesn't have multiple paragraphs, and doesn't look like other formats
  if (cleanContent.length <= 280 && !cleanContent.includes('\n\n') && !cleanContent.includes('##')) {
    // Make sure it's not a question or instruction
    if (!cleanContent.endsWith('?') && !cleanContent.includes('você') && !cleanContent.includes('precisa')) {
      return true;
    }
  }
  return false;
}

// Detect if content contains a social media post
export function detectSocialPost(content: string): DetectedPost | null {
  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        // Extract the post content after the pattern
        const startIndex = match.index! + match[0].length;
        let postContent = content.slice(startIndex).trim();
        
        // Clean up the content
        postContent = postContent
          .replace(/^[\n\r]+/, "") // Remove leading newlines
          .replace(/---\s*(TWEET|INSTAGRAM|LINKEDIN)\s*---/gi, "") // Remove markers
          .trim();

        // Try to find the end of the post (next section or end)
        const endMarkers = ["\n\n---", "\n\n##", "\n\n**Notas", "\n\n**Observações"];
        for (const marker of endMarkers) {
          const endIndex = postContent.indexOf(marker);
          if (endIndex !== -1) {
            postContent = postContent.slice(0, endIndex).trim();
            break;
          }
        }

        return {
          platform: platform as PostPlatform,
          content: postContent,
        };
      }
    }
  }
  
  // Fallback: check if the entire content looks like a short tweet
  if (isLikelyTweet(content)) {
    return {
      platform: "twitter",
      content: content.trim(),
    };
  }
  
  return null;
}

/**
 * Parse content to extract individual tweets from a thread.
 * Supports multiple formats:
 * - 1/ 2/ 3/ (numbered with slash)
 * - 1. 2. 3. (numbered with period)
 * - --- separators
 * - Tweet 1: Tweet 2: markers
 * - **Tweet 1** **Tweet 2** markers
 * - ## Tweet 1 ## Tweet 2 headers
 */
export function parseThreadContent(content: string): ParsedThread | null {
  const tweets: ThreadTweet[] = [];
  
  // Pattern 1: Numbered with slash (1/ 2/ 3/)
  const slashPattern = /(?:^|\n)(\d+)\/\s*([\s\S]*?)(?=\n\d+\/|$)/g;
  const slashMatches = [...content.matchAll(slashPattern)];
  
  if (slashMatches.length >= 2) {
    slashMatches.forEach((match, index) => {
      const text = match[2].trim();
      if (text) {
        tweets.push({
          id: `tweet-${index + 1}`,
          text,
          media_urls: []
        });
      }
    });
    if (tweets.length >= 2) return { tweets };
  }
  
  // Pattern 2: --- separators
  const separatorParts = content.split(/\n---\n|\n-{3,}\n/);
  if (separatorParts.length >= 2) {
    separatorParts.forEach((part, index) => {
      const text = part.trim()
        .replace(/^(tweet\s*\d*\s*:?\s*)/i, '') // Remove "Tweet X:" prefix
        .replace(/^\*\*Tweet\s*\d+\*\*\s*/i, '') // Remove **Tweet X** prefix
        .trim();
      if (text && text.length > 0) {
        tweets.push({
          id: `tweet-${index + 1}`,
          text,
          media_urls: []
        });
      }
    });
    if (tweets.length >= 2) return { tweets };
  }
  
  // Pattern 3: Tweet X: markers
  const tweetMarkerPattern = /(?:^|\n)(?:Tweet\s*(\d+)\s*:?\s*)([\s\S]*?)(?=\nTweet\s*\d+\s*:?|$)/gi;
  const tweetMarkerMatches = [...content.matchAll(tweetMarkerPattern)];
  
  if (tweetMarkerMatches.length >= 2) {
    tweetMarkerMatches.forEach((match, index) => {
      const text = match[2].trim();
      if (text) {
        tweets.push({
          id: `tweet-${index + 1}`,
          text,
          media_urls: []
        });
      }
    });
    if (tweets.length >= 2) return { tweets };
  }
  
  // Pattern 4: **Tweet X** or ## Tweet X headers
  const headerPattern = /(?:\*\*Tweet\s*\d+\*\*|##\s*Tweet\s*\d+)\s*([\s\S]*?)(?=\*\*Tweet\s*\d+\*\*|##\s*Tweet\s*\d+|$)/gi;
  const headerMatches = [...content.matchAll(headerPattern)];
  
  if (headerMatches.length >= 2) {
    headerMatches.forEach((match, index) => {
      const text = match[1].trim();
      if (text) {
        tweets.push({
          id: `tweet-${index + 1}`,
          text,
          media_urls: []
        });
      }
    });
    if (tweets.length >= 2) return { tweets };
  }
  
  // Pattern 5: Numbered with period (1. 2. 3.) - at start of lines
  const numberedPattern = /(?:^|\n)(\d+)\.\s*([\s\S]*?)(?=\n\d+\.\s|$)/g;
  const numberedMatches = [...content.matchAll(numberedPattern)];
  
  if (numberedMatches.length >= 2) {
    numberedMatches.forEach((match, index) => {
      const text = match[2].trim();
      // Only include if it looks like tweet content (short-ish)
      if (text && text.length <= 500) {
        tweets.push({
          id: `tweet-${index + 1}`,
          text,
          media_urls: []
        });
      }
    });
    if (tweets.length >= 2) return { tweets };
  }
  
  // Pattern 6: Double newlines with content - fallback for paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length >= 2 && paragraphs.every(p => p.length <= 400)) {
    paragraphs.forEach((para, index) => {
      const text = para.trim()
        .replace(/^(\d+[\/\.]\s*)/g, '') // Remove leading numbers
        .replace(/^(tweet\s*\d*\s*:?\s*)/i, '') // Remove Tweet X:
        .trim();
      if (text) {
        tweets.push({
          id: `tweet-${index + 1}`,
          text,
          media_urls: []
        });
      }
    });
    if (tweets.length >= 2) return { tweets };
  }
  
  return null;
}

// Detect carousel slides in content
export function detectCarousel(content: string): DetectedCarousel | null {
  const slidePatterns = [
    /---\s*SLIDE\s*(\d+)\s*---/gi,
    /\*\*SLIDE\s*(\d+)\*\*/gi,
    /##\s*Slide\s*(\d+)/gi,
  ];

  let slides: CarouselSlide[] = [];

  // Try different patterns
  for (const pattern of slidePatterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length >= 2) {
      // Found slides
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const startIndex = match.index! + match[0].length;
        const endIndex = matches[i + 1]?.index ?? content.length;
        
        let slideContent = content.slice(startIndex, endIndex).trim();
        
        // Extract title (first line or **Title**)
        let title = `Slide ${i + 1}`;
        const titleMatch = slideContent.match(/^\*\*(.+?)\*\*/);
        if (titleMatch) {
          title = titleMatch[1];
          slideContent = slideContent.slice(titleMatch[0].length).trim();
        } else {
          const firstLine = slideContent.split("\n")[0];
          if (firstLine && firstLine.length < 100) {
            title = firstLine.replace(/^#+\s*/, "");
            slideContent = slideContent.slice(firstLine.length).trim();
          }
        }

        // Determine slide type
        let type: "hook" | "content" | "cta" = "content";
        if (i === 0 || /gancho|hook|atenção/i.test(title)) {
          type = "hook";
        } else if (i === matches.length - 1 || /cta|ação|call|siga|link/i.test(title)) {
          type = "cta";
        }

        slides.push({
          id: `slide-${i + 1}`,
          title,
          content: slideContent.trim(),
          type,
        });
      }
      
      return { slides };
    }
  }

  // Alternative: numbered list format with bold titles
  const numberedPattern = /^(\d+)\.\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=\n\d+\.\s*\*\*|$)/gm;
  const numberedMatches = [...content.matchAll(numberedPattern)];
  
  if (numberedMatches.length >= 2) {
    slides = numberedMatches.map((match, index) => ({
      id: `slide-${index + 1}`,
      title: match[2].trim(),
      content: match[3].trim(),
      type: index === 0 ? "hook" : index === numberedMatches.length - 1 ? "cta" : "content",
    }));
    return { slides };
  }
  
  // Alternative: --- separators with content blocks
  const separatorBlocks = content.split(/\n---\n|\n-{3,}\n/).filter(b => b.trim());
  if (separatorBlocks.length >= 2) {
    slides = separatorBlocks.map((block, index) => {
      const lines = block.trim().split('\n');
      let title = lines[0]?.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim() || `Slide ${index + 1}`;
      const contentText = lines.slice(1).join('\n').trim();
      
      return {
        id: `slide-${index + 1}`,
        title: title.length > 80 ? `Slide ${index + 1}` : title,
        content: title.length > 80 ? block.trim() : contentText,
        type: index === 0 ? "hook" : index === separatorBlocks.length - 1 ? "cta" : "content" as "hook" | "content" | "cta",
      };
    });
    return { slides };
  }

  return null;
}

// Check if content looks like a thread
export function isLikelyThread(content: string): boolean {
  // Check for common thread patterns
  if (/(\d+)\//.test(content)) return true; // 1/ 2/ 3/
  if (/Tweet\s*\d+/i.test(content)) return true; // Tweet 1, Tweet 2
  if (/\*\*Tweet\s*\d+\*\*/i.test(content)) return true; // **Tweet 1**
  if ((content.match(/\n---\n/g) || []).length >= 1) return true; // --- separators
  return false;
}

// Check if content looks like a carousel
export function isLikelyCarousel(content: string): boolean {
  if (/slide\s*\d+/i.test(content)) return true;
  if (/carrossel/i.test(content)) return true;
  if (/---\s*SLIDE/i.test(content)) return true;
  return false;
}

// Parse content and extract all detected elements
export interface ParsedContent {
  posts: DetectedPost[];
  carousel: DetectedCarousel | null;
  thread: ParsedThread | null;
  remainingContent: string;
}

export function parseContentForPosts(content: string): ParsedContent {
  const posts: DetectedPost[] = [];
  let remainingContent = content;

  // Check for social posts
  const post = detectSocialPost(content);
  if (post) {
    posts.push(post);
  }

  // Check for carousel
  const carousel = detectCarousel(content);
  
  // Check for thread
  const thread = parseThreadContent(content);

  return {
    posts,
    carousel,
    thread,
    remainingContent,
  };
}
