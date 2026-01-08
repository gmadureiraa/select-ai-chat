import { useState, useMemo } from "react";
import { MessageSquare, Clock, Trash2, Plus, Search, MessageCircle, Lightbulb, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Conversation } from "@/types/chat";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ConversationSearch } from "@/components/chat/ConversationSearch";

interface ConversationSidebarProps {
  clientId: string;
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

interface GroupedConversations {
  today: Conversation[];
  yesterday: Conversation[];
  thisWeek: Conversation[];
  older: Conversation[];
}

const getModeIcon = (title: string) => {
  if (title.toLowerCase().includes("ideia") || title.toLowerCase().includes("sugest")) {
    return <Lightbulb className="h-3.5 w-3.5 text-amber-500" />;
  }
  if (title.toLowerCase().includes("chat") || title.toLowerCase().includes("livre")) {
    return <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />;
  }
  return <FileText className="h-3.5 w-3.5 text-primary" />;
};

export const ConversationSidebar = ({ 
  clientId, 
  currentConversationId,
  onSelectConversation,
  onNewConversation 
}: ConversationSidebarProps) => {
  const { data: conversations, refetch } = useConversationHistory(clientId);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => 
      c.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const groupedConversations = useMemo((): GroupedConversations => {
    const groups: GroupedConversations = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    filteredConversations.forEach(conv => {
      const date = parseISO(conv.updated_at || conv.created_at);
      if (isToday(date)) {
        groups.today.push(conv);
      } else if (isYesterday(date)) {
        groups.yesterday.push(conv);
      } else if (isThisWeek(date)) {
        groups.thisWeek.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  }, [filteredConversations]);

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
      
      if (conversationId === currentConversationId) {
        onNewConversation();
      }
    } catch (error) {
      toast.error("Erro ao excluir conversa");
    } finally {
      setDeletingId(null);
    }
  };

  const renderConversationItem = (conversation: Conversation) => (
    <div
      key={conversation.id}
      onClick={() => onSelectConversation(conversation.id)}
      className={cn(
        "group flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-all",
        "hover:bg-accent/50 border border-transparent hover:border-border/50",
        currentConversationId === conversation.id && "bg-accent border-border"
      )}
    >
      <div className="shrink-0 mt-0.5">
        {getModeIcon(conversation.title)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{conversation.title}</p>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNow(new Date(conversation.updated_at || conversation.created_at), { 
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
  );

  const renderGroup = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-2">
          {title}
        </p>
        {items.map(renderConversationItem)}
      </div>
    );
  };

  const hasConversations = conversations && conversations.length > 0;
  const hasResults = filteredConversations.length > 0;

  return (
    <div className="w-64 border-r bg-card/30 flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Button 
          onClick={onNewConversation} 
          className="w-full justify-start gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Nova Conversa
        </Button>
        
        {hasConversations && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <ConversationSearch clientId={clientId} onSelectConversation={onSelectConversation} />
          </div>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {!hasConversations ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa</p>
            </div>
          ) : !hasResults ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p>Nenhum resultado</p>
            </div>
          ) : (
            <>
              {renderGroup("Hoje", groupedConversations.today)}
              {renderGroup("Ontem", groupedConversations.yesterday)}
              {renderGroup("Esta Semana", groupedConversations.thisWeek)}
              {renderGroup("Anteriores", groupedConversations.older)}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
