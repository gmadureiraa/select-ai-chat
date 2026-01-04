import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanningItemDialog } from "@/components/planning/PlanningItemDialog";
import { usePlanningItems, CreatePlanningItemInput } from "@/hooks/usePlanningItems";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { parseThreadContent, detectCarousel, isLikelyThread, isLikelyCarousel } from "@/lib/postDetection";

interface AddToPlanningButtonProps {
  content: string;
  platform?: string;
  clientId?: string;
  clientName?: string;
  mediaUrls?: string[];
}

// Helper to detect platform from content
const detectPlatformFromContent = (content: string): string | undefined => {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes("thread") || lowerContent.includes("tweet")) return "twitter";
  if (lowerContent.includes("instagram") || lowerContent.includes("#") || lowerContent.includes("carrossel")) return "instagram";
  if (lowerContent.includes("linkedin")) return "linkedin";
  if (lowerContent.includes("newsletter") || lowerContent.includes("email")) return "newsletter";
  if (lowerContent.includes("blog") || lowerContent.includes("artigo")) return "blog";
  if (lowerContent.includes("youtube") || lowerContent.includes("vídeo")) return "youtube";
  if (lowerContent.includes("tiktok") || lowerContent.includes("reels")) return "tiktok";
  return undefined;
};

// Helper to extract a title from content
const extractTitleFromContent = (content: string): string => {
  // Try to get first line or first sentence
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^#+\s*/, '').replace(/^\d+[\/\.]\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
    if (firstLine.length <= 100) return firstLine;
    return firstLine.substring(0, 97) + "...";
  }
  return "Novo conteúdo";
};

// Helper to detect content type
const detectContentType = (content: string, platform?: string): string => {
  if (platform === 'twitter' && isLikelyThread(content)) return 'thread';
  if (platform === 'instagram' && isLikelyCarousel(content)) return 'carousel';
  if (isLikelyThread(content)) return 'thread';
  if (isLikelyCarousel(content)) return 'carousel';
  if (platform === 'newsletter' || platform === 'blog') return 'article';
  return 'post';
};

export const AddToPlanningButton = ({
  content,
  platform,
  clientId,
  clientName,
  mediaUrls = [],
}: AddToPlanningButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const { workspace } = useWorkspaceContext();
  const { columns, createItem, isLoading: isLoadingItems } = usePlanningItems();

  const handleOpenDialog = () => {
    if (!workspace?.id) {
      toast.error("Workspace não encontrado. Por favor, recarregue a página.");
      return;
    }
    setShowDialog(true);
  };

  const handleSave = async (data: CreatePlanningItemInput) => {
    if (!workspace?.id) {
      toast.error("Workspace não encontrado");
      return;
    }
    await createItem.mutateAsync(data);
    setShowDialog(false);
  };

  // Get the "idea" column as default
  const ideaColumn = columns.find(c => c.column_type === 'idea');
  const detectedPlatform = platform || detectPlatformFromContent(content);
  const detectedContentType = detectContentType(content, detectedPlatform);
  
  // Parse structured content
  let parsedThreadTweets: Array<{ id: string; text: string; media_urls: string[] }> | undefined;
  let parsedCarouselSlides: Array<{ id: string; title: string; content: string; type: string }> | undefined;
  
  if (detectedContentType === 'thread') {
    const parsed = parseThreadContent(content);
    if (parsed) {
      parsedThreadTweets = parsed.tweets;
    }
  } else if (detectedContentType === 'carousel') {
    const parsed = detectCarousel(content);
    if (parsed) {
      parsedCarouselSlides = parsed.slides.map(s => ({
        id: s.id,
        title: s.title,
        content: s.content,
        type: s.type || 'content'
      }));
    }
  }

  const isDisabled = isLoadingItems || !workspace?.id;

  // Build metadata with parsed content
  const metadata: Record<string, any> = {
    content_type: detectedContentType,
  };
  
  if (parsedThreadTweets && parsedThreadTweets.length > 0) {
    metadata.thread_tweets = parsedThreadTweets;
  }
  
  if (parsedCarouselSlides && parsedCarouselSlides.length > 0) {
    metadata.carousel_slides = parsedCarouselSlides;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
        disabled={isDisabled}
        className={cn(
          "h-7 text-xs gap-1.5 bg-gradient-to-r from-emerald-500/5 to-emerald-500/10 border-emerald-500/20",
          "hover:from-emerald-500/10 hover:to-emerald-500/20 hover:border-emerald-500/40"
        )}
      >
        {isLoadingItems ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Calendar className="h-3 w-3" />
        )}
        Enviar para Planejamento
      </Button>

      <PlanningItemDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        columns={columns}
        defaultColumnId={ideaColumn?.id}
        onSave={handleSave}
        item={{
          id: "",
          workspace_id: "",
          title: extractTitleFromContent(content),
          description: "",
          content: content,
          client_id: clientId || null,
          column_id: ideaColumn?.id || null,
          platform: detectedPlatform as any || null,
          status: "idea",
          priority: "medium",
          position: 0,
          created_by: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          due_date: null,
          scheduled_at: null,
          labels: [],
          media_urls: mediaUrls,
          metadata,
          assigned_to: null,
          content_type: detectedContentType,
          content_library_id: null,
          added_to_library: false,
          external_post_id: null,
          published_at: null,
          error_message: null,
          retry_count: 0,
        } as any}
      />
    </>
  );
};
