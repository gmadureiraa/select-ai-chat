import { useState, useMemo } from "react";
import { 
  Search,
  Clock,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Check,
  X
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConversationHistory, updateConversationTitle, deleteConversation } from "@/hooks/useConversationHistory";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const { data: conversations, refetch } = useConversationHistory(clientId);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const handleStartEdit = (conv: { id: string; title: string }) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveTitle = async () => {
    if (!editingId || !editingTitle.trim()) return;
    
    try {
      await updateConversationTitle(editingId, editingTitle.trim());
      queryClient.invalidateQueries({ queryKey: ["conversation-history", clientId] });
      setEditingId(null);
      setEditingTitle("");
    } catch (error) {
      console.error("Error updating title:", error);
      toast({
        title: "Erro ao renomear",
        description: "Não foi possível renomear a conversa.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId);
      queryClient.invalidateQueries({ queryKey: ["conversation-history", clientId] });
      
      // Se deletou a conversa atual, criar nova
      if (currentConversationId === convId) {
        onSelectTemplate(null, undefined);
      }
      
      toast({
        title: "Conversa apagada",
        description: "A conversa foi removida permanentemente.",
      });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Erro ao apagar",
        description: "Não foi possível apagar a conversa.",
        variant: "destructive",
      });
    }
  };

  const renderConversationItem = (conv: { id: string; title: string; updated_at?: string | null; created_at: string | null }) => {
    const isActive = currentConversationId === conv.id;
    const isEditing = editingId === conv.id;
    
    if (isEditing) {
      return (
        <div
          key={conv.id}
          className={cn(
            "w-full flex items-center gap-2 p-2.5 rounded-lg",
            "bg-accent border border-border"
          )}
        >
          <Input
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            className="h-7 text-sm flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") handleCancelEdit();
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary"
            onClick={handleSaveTitle}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={handleCancelEdit}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }
    
    return (
      <div
        key={conv.id}
        className={cn(
          "w-full flex items-start gap-2.5 p-2.5 rounded-lg transition-all group",
          "hover:bg-accent/50 border border-transparent hover:border-border/50",
          isActive && "bg-accent border-border"
        )}
      >
        <button
          onClick={() => onSelectConversation(conv.id)}
          className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
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
        
        {/* Action buttons - show on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(conv);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A conversa "{conv.title}" será removida permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => handleDeleteConversation(conv.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
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