import { useState, useMemo } from "react";
import { 
  Search,
  Clock,
  MessageSquare,
  Plus
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatOptionsSidebarProps {
  clientId: string;
  currentConversationId: string | null;
  onSelectTemplate: (templateId: string | null, templateName?: string) => void;
  onSelectConversation: (conversationId: string) => void;
}

export const ChatOptionsSidebar = ({
  clientId, 
  currentConversationId,
  onSelectTemplate,
  onSelectConversation
}: ChatOptionsSidebarProps) => {
  const { data: conversations } = useConversationHistory(clientId);
  const [searchQuery, setSearchQuery] = useState("");

  // All conversations (no template filter needed anymore)
  const allConversations = useMemo(() => {
    if (!conversations) return [];
    return conversations;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return allConversations;
    const query = searchQuery.toLowerCase();
    return allConversations.filter(c => 
      c.title.toLowerCase().includes(query)
    );
  }, [allConversations, searchQuery]);

  const handleNewChat = () => {
    onSelectTemplate(null, undefined);
  };

  const renderConversationItem = (conv: { id: string; title: string; updated_at?: string | null; created_at: string | null }) => {
    const isActive = currentConversationId === conv.id;
    
    return (
      <button
        key={conv.id}
        onClick={() => onSelectConversation(conv.id)}
        className={cn(
          "w-full flex items-start gap-2.5 p-2.5 rounded-lg transition-all",
          "hover:bg-accent/50 border border-transparent hover:border-border/50",
          "text-left group",
          isActive && "bg-accent border-border"
        )}
      >
        <div className="p-1.5 rounded-md shrink-0 bg-muted">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{conv.title}</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(conv.updated_at || conv.created_at), { 
              addSuffix: true, 
              locale: ptBR 
            })}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="w-72 border-r bg-card/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Conversas</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-7 px-2 text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            Nova
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      
      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs px-4">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{searchQuery ? "Nenhum resultado" : "Nenhuma conversa ainda"}</p>
              <p className="text-[10px] mt-1">Comece uma nova conversa usando @ para formatos</p>
            </div>
          ) : (
            filteredConversations.map(renderConversationItem)
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
