import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanningItemDialog } from "@/components/planning/PlanningItemDialog";
import { usePlanningItems, CreatePlanningItemInput } from "@/hooks/usePlanningItems";

interface AddToPlanningButtonProps {
  content: string;
  platform?: string;
  clientId?: string;
  clientName?: string;
}

// Helper to detect platform from content
const detectPlatformFromContent = (content: string): string | undefined => {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes("instagram") || lowerContent.includes("#")) return "instagram";
  if (lowerContent.includes("linkedin")) return "linkedin";
  if (lowerContent.includes("twitter") || lowerContent.includes("tweet") || lowerContent.includes("thread")) return "twitter";
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
    const firstLine = lines[0].replace(/^#+\s*/, '').trim();
    if (firstLine.length <= 100) return firstLine;
    return firstLine.substring(0, 97) + "...";
  }
  return "Novo conteúdo";
};

export const AddToPlanningButton = ({
  content,
  platform,
  clientId,
  clientName,
}: AddToPlanningButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const { columns, createItem, isLoading: isLoadingItems } = usePlanningItems();

  const handleSave = async (data: CreatePlanningItemInput) => {
    await createItem.mutateAsync(data);
    setShowDialog(false);
  };

  // Get the "idea" column as default
  const ideaColumn = columns.find(c => c.column_type === 'idea');
  const detectedPlatform = platform || detectPlatformFromContent(content);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={isLoadingItems}
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
          media_urls: [],
          metadata: {},
          assigned_to: null,
          content_type: null,
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