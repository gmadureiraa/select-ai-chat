import { useState } from "react";
import { MessageSquare, X, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
}

interface NodeCommentProps {
  comments: Comment[];
  onAddComment: (text: string) => void;
  onResolve?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

export function NodeComment({
  comments,
  onAddComment,
  onResolve,
  onDelete,
}: NodeCommentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const unresolvedComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment("");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 relative",
            unresolvedComments.length > 0 && "text-amber-500"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {unresolvedComments.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[9px] flex items-center justify-center"
            >
              {unresolvedComments.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comentários
            {unresolvedComments.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4">
                {unresolvedComments.length} pendente{unresolvedComments.length !== 1 && "s"}
              </Badge>
            )}
          </h4>
        </div>

        <ScrollArea className="max-h-[250px]">
          {unresolvedComments.length === 0 && resolvedComments.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum comentário ainda
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {unresolvedComments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-2 rounded-md bg-muted/50 text-xs space-y-1"
                >
                  <p>{comment.text}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{formatDate(comment.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      {onResolve && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[10px] px-1.5 hover:text-green-600"
                          onClick={() => onResolve(comment.id)}
                        >
                          Resolver
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-destructive"
                          onClick={() => onDelete(comment.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {resolvedComments.length > 0 && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-6 text-[10px] text-muted-foreground"
                    onClick={() => setShowResolved(!showResolved)}
                  >
                    {showResolved ? (
                      <ChevronUp className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    )}
                    {resolvedComments.length} resolvido{resolvedComments.length !== 1 && "s"}
                  </Button>
                  
                  {showResolved && (
                    <div className="mt-2 space-y-2 opacity-60">
                      {resolvedComments.map((comment) => (
                        <div
                          key={comment.id}
                          className="p-2 rounded-md bg-muted/30 text-xs line-through"
                        >
                          <p>{comment.text}</p>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicionar comentário..."
              className="min-h-[60px] text-xs resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSubmit}
              disabled={!newComment.trim()}
            >
              <Send className="h-3 w-3" />
              Enviar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
