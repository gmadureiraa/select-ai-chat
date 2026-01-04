import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlanningComments, PlanningComment } from "@/hooks/usePlanningComments";
import { useAuth } from "@/hooks/useAuth";

interface PlanningItemCommentsProps {
  planningItemId: string | undefined;
}

export function PlanningItemComments({ planningItemId }: PlanningItemCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const { comments, isLoading, addComment, deleteComment, isAdding } = usePlanningComments(planningItemId);
  const { user } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    addComment(newComment.trim());
    setNewComment("");
  };

  if (!planningItemId) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Salve o card primeiro para adicionar comentários.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[300px]">
      <ScrollArea className="flex-1 pr-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhum comentário ainda. Seja o primeiro!
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                isOwner={comment.user_id === user?.id}
                onDelete={() => deleteComment(comment.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2 mt-4 pt-4 border-t">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Adicionar comentário..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!newComment.trim() || isAdding}>
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}

function CommentItem({ 
  comment, 
  isOwner, 
  onDelete 
}: { 
  comment: PlanningComment; 
  isOwner: boolean; 
  onDelete: () => void;
}) {
  const profile = comment.profile;
  const name = profile?.full_name || profile?.email?.split("@")[0] || "Usuário";
  const initial = name[0]?.toUpperCase() || "?";

  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={profile?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </span>
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
        <p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-wrap">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
