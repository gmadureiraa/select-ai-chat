import { PostPlatform } from "@/components/posts";
import { CarouselSlide } from "@/components/posts/CarouselEditor";

export interface DetectedPost {
  platform: PostPlatform;
  content: string;
}

export interface DetectedCarousel {
  slides: CarouselSlide[];
}

// Patterns to detect social media posts
const platformPatterns: Record<PostPlatform, RegExp[]> = {
  twitter: [
    /^tweet\s*:/im,
    /twitter\s*:/i,
    /para\s+o?\s*(twitter|x)\s*:/i,
    /post\s+no\s+(twitter|x)/i,
    /---\s*TWEET\s*---/i,
  ],
  instagram: [
    /instagram\s*:/i,
    /caption\s*:/i,
    /legenda\s*(instagram)?\s*:/i,
    /para\s+o?\s*instagram\s*:/i,
    /post\s+no\s+instagram/i,
  ],
  linkedin: [
    /linkedin\s*:/i,
    /para\s+o?\s*linkedin\s*:/i,
    /post\s+no\s+linkedin/i,
    /---\s*LINKEDIN\s*---/i,
  ],
};

// Check if content looks like a short tweet (<=280 chars, single block)
// IMPORTANT: This function is now MORE RESTRICTIVE to avoid false positives
function isLikelyTweet(content: string): boolean {
  const cleanContent = content.trim();
  
  // Must have explicit tweet markers or hashtags to be considered a tweet
  const hasTweetMarkers = 
    cleanContent.includes('#') || // Has hashtags
    cleanContent.includes('@') ||  // Has mentions
    /^(tweet|post para (twitter|x))/i.test(cleanContent); // Explicit tweet prefix
  
  // Skip if it looks like a conversational AI response
  const isConversationalResponse = 
    cleanContent.endsWith('?') ||
    cleanContent.includes('você') ||
    cleanContent.includes('precisa') ||
    cleanContent.includes('posso') ||
    cleanContent.includes('vou') ||
    cleanContent.includes('não tenho') ||
    cleanContent.includes('infelizmente') ||
    cleanContent.includes('de acordo com') ||
    cleanContent.startsWith('Olá') ||
    cleanContent.startsWith('Oi') ||
    /^\d+\./.test(cleanContent) || // Starts with numbered list
    cleanContent.includes('**'); // Has markdown bold (usually explanatory text)
  
  if (isConversationalResponse) {
    return false;
  }
  
  // Only consider as tweet if it has markers AND is short
  if (cleanContent.length <= 280 && hasTweetMarkers && !cleanContent.includes('\n\n') && !cleanContent.includes('##')) {
    return true;
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

  // Alternative: numbered list format
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

  return null;
}

// Parse content and extract all detected elements
export interface ParsedContent {
  posts: DetectedPost[];
  carousel: DetectedCarousel | null;
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

  return {
    posts,
    carousel,
    remainingContent,
  };
}
