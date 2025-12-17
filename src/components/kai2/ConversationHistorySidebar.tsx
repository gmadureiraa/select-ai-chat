import { useState } from "react";
import { History, MessageSquare, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConversationHistorySidebarProps {
  clientId: string;
  currentConversationId?: string;
  onSelectConversation: (conversationId: string, templateId?: string) => void;
}

export const ConversationHistorySidebar = ({
  clientId,
  currentConversationId,
  onSelectConversation,
}: ConversationHistorySidebarProps) => {
  const { data: conversations, refetch } = useConversationHistory(clientId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(conversationId);
    
    try {
      // Delete messages first
      await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);
      
      // Then delete conversation
      await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);
      
      refetch();
      toast.success("Conversa excluída");
    } catch (error) {
      toast.error("Erro ao excluir conversa");
    } finally {
      setDeletingId(null);
    }
  };

  const groupConversations = () => {
    if (!conversations) return { today: [], yesterday: [], thisWeek: [], older: [] };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups = {
      today: [] as typeof conversations,
      yesterday: [] as typeof conversations,
      thisWeek: [] as typeof conversations,
      older: [] as typeof conversations,
    };

    conversations.forEach((conv) => {
      const date = new Date(conv.updated_at || conv.created_at);
      if (date >= today) {
        groups.today.push(conv);
      } else if (date >= yesterday) {
        groups.yesterday.push(conv);
      } else if (date >= weekAgo) {
        groups.thisWeek.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  };

  const groups = groupConversations();

  const renderGroup = (title: string, convs: typeof conversations) => {
    if (!convs || convs.length === 0) return null;
    
    return (
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground/50 px-3 py-1 font-medium uppercase tracking-wider">
          {title}
        </p>
        {convs.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id, conv.template_id || undefined)}
            className={cn(
              "w-full group flex items-center gap-2 text-left text-sm py-2 px-3 rounded-md transition-colors",
              currentConversationId === conv.id
                ? "bg-muted/60 text-foreground"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="flex-1 truncate text-xs">{conv.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => handleDelete(conv.id, e)}
              disabled={deletingId === conv.id}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          </button>
        ))}
      </div>
    );
  };

  if (!conversations || conversations.length === 0) {
    return (
      <div className="p-4 text-center">
        <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Nenhuma conversa ainda</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {renderGroup("Hoje", groups.today)}
        {renderGroup("Ontem", groups.yesterday)}
        {renderGroup("Esta Semana", groups.thisWeek)}
        {renderGroup("Anteriores", groups.older)}
      </div>
    </ScrollArea>
  );
};
