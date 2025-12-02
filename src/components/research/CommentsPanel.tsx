import { useState } from "react";
import { useResearchComments, ResearchComment } from "@/hooks/useResearchComments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MessageSquare,
  Send,
  Check,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CommentsPanelProps {
  projectId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const CommentsPanel = ({ projectId, open, onOpenChange }: CommentsPanelProps) => {
  const { comments, createComment, updateComment, deleteComment, unresolvedCount } = useResearchComments(projectId);
  const [newComment, setNewComment] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createComment.mutate({ content: newComment });
    setNewComment("");
  };

  const filteredComments = comments.filter(c => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentários do Projeto
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Filter buttons */}
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todos ({comments.length})
            </Button>
            <Button
              variant={filter === "open" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("open")}
            >
              Abertos ({unresolvedCount})
            </Button>
            <Button
              variant={filter === "resolved" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("resolved")}
            >
              Resolvidos ({comments.length - unresolvedCount})
            </Button>
          </div>

          {/* New comment input */}
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar comentário..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <Button 
              size="icon" 
              onClick={handleSubmit}
              disabled={!newComment.trim() || createComment.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Comments list */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-3 pr-4">
              {filteredComments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum comentário {filter !== "all" && filter === "open" ? "aberto" : filter === "resolved" ? "resolvido" : ""}
                </p>
              ) : (
                filteredComments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onResolve={() => updateComment.mutate({ id: comment.id, resolved: !comment.resolved })}
                    onDelete={() => deleteComment.mutate(comment.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};

interface CommentCardProps {
  comment: ResearchComment;
  onResolve: () => void;
  onDelete: () => void;
}

const CommentCard = ({ comment, onResolve, onDelete }: CommentCardProps) => {
  return (
    <div className={`p-3 rounded-lg border ${comment.resolved ? "bg-muted/30 opacity-60" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm flex-1 ${comment.resolved ? "line-through" : ""}`}>
          {comment.content}
        </p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onResolve}
            title={comment.resolved ? "Reabrir" : "Resolver"}
          >
            {comment.resolved ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5 text-green-500" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatDistanceToNow(new Date(comment.created_at), { 
          addSuffix: true, 
          locale: ptBR 
        })}
      </p>
    </div>
  );
};
