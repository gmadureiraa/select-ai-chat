import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Youtube, 
  Eye, 
  Trash2, 
  ChevronRight,
  FileText,
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RepurposeHistoryItem, useRepurposeHistory } from "@/hooks/useRepurposeHistory";
import { GeneratedContent } from "@/hooks/useContentRepurpose";
import { cn } from "@/lib/utils";

interface RepurposeHistoryCardsProps {
  clientId?: string;
  onViewResults: (item: RepurposeHistoryItem) => void;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  sales: "Vendas",
  lead_generation: "Leads",
  educational: "Educacional",
  brand_awareness: "Marca",
};

const FORMAT_LABELS: Record<string, string> = {
  newsletter: "Newsletter",
  thread: "Thread",
  tweet: "Tweet",
  carousel: "Carrossel",
  linkedin_post: "LinkedIn",
  instagram_post: "Instagram",
  reels_script: "Reels",
  blog_post: "Blog",
  email_marketing: "Email",
  cut_moments: "Cortes",
};

export function RepurposeHistoryCards({ clientId, onViewResults }: RepurposeHistoryCardsProps) {
  const { history, isLoading, deleteHistory } = useRepurposeHistory(clientId);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  const handleDelete = async () => {
    if (deleteId) {
      await deleteHistory.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const getFormatsFromContents = (contents: GeneratedContent[]) => {
    return contents.map((c) => c.format);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">
          Reaproveitamentos Anteriores
        </h3>
      </div>

      <div className="grid gap-3">
        {history.map((item) => {
          const formats = getFormatsFromContents(item.generated_contents);
          
          return (
            <Card 
              key={item.id} 
              className="overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => onViewResults(item)}
            >
              <CardContent className="p-0">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="relative w-28 h-16 flex-shrink-0 bg-muted">
                    {item.video_thumbnail ? (
                      <img 
                        src={item.video_thumbnail} 
                        alt={item.video_title || "Video"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Youtube className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 py-2 pr-2">
                    <p className="font-medium text-sm truncate">
                      {item.video_title || "Vídeo sem título"}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.objective && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {OBJECTIVE_LABELS[item.objective] || item.objective}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formats.length} conteúdo{formats.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>

                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {formats.slice(0, 4).map((format, i) => (
                        <Badge 
                          key={i} 
                          variant="outline" 
                          className="text-[10px] h-4 px-1.5"
                        >
                          {FORMAT_LABELS[format] || format}
                        </Badge>
                      ))}
                      {formats.length > 4 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          +{formats.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 pr-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reaproveitamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os conteúdos gerados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteHistory.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
