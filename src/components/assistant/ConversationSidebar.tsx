import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Clock, Trash2, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Conversation } from "@/types/chat";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ConversationSidebarProps {
  clientId: string;
  onNewConversation: () => void;
}

export const ConversationSidebar = ({ clientId, onNewConversation }: ConversationSidebarProps) => {
  const navigate = useNavigate();
  const { data: conversations, refetch } = useConversationHistory(clientId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(conversationId);
    
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);
      
      if (error) throw error;
      toast.success("Conversa excluída");
      refetch();
    } catch (error) {
      toast.error("Erro ao excluir conversa");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelect = (conversationId: string) => {
    navigate(`/chat/${clientId}?conversationId=${conversationId}`);
  };

  return (
    <div className="w-64 border-r bg-card/30 flex flex-col h-full">
      <div className="p-3 border-b">
        <Button 
          onClick={onNewConversation} 
          className="w-full justify-start gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Nova Conversa
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa</p>
            </div>
          ) : (
            conversations?.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelect(conversation.id)}
                className={cn(
                  "group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all",
                  "hover:bg-accent/50 border border-transparent hover:border-border/50"
                )}
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conversation.title}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(conversation.updated_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => handleDelete(conversation.id, e)}
                  disabled={deletingId === conversation.id}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
