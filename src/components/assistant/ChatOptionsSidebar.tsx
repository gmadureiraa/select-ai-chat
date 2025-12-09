import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  Image, 
  Search
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { TemplateManager } from "@/components/clients/TemplateManager";
import { cn } from "@/lib/utils";

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
  const { templates, isLoading: templatesLoading } = useClientTemplates(clientId);
  const { data: conversations } = useConversationHistory(clientId);
  const [searchQuery, setSearchQuery] = useState("");

  const chatTemplates = templates?.filter(t => t.type === "chat") || [];
  const imageTemplates = templates?.filter(t => t.type === "image") || [];

  const filteredChatTemplates = chatTemplates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredImageTemplates = imageTemplates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Encontrar a conversa associada a cada template (apenas uma por template)
  const getTemplateConversation = (templateId: string) => {
    return (conversations || []).find(conv => conv.template_id === templateId);
  };

  const renderTemplate = (
    template: { id: string; name: string; rules?: any[] },
    type: "chat" | "image"
  ) => {
    const conversation = getTemplateConversation(template.id);
    const Icon = type === "chat" ? FileText : Image;
    const iconColor = type === "chat" ? "text-primary" : "text-pink-500";
    const bgColor = type === "chat" ? "bg-primary/10" : "bg-pink-500/10";
    const isActive = conversation && currentConversationId === conversation.id;

    const handleClick = () => {
      if (conversation) {
        // Se já tem conversa, abre ela
        onSelectConversation(conversation.id);
      } else {
        // Se não tem, cria uma nova
        onSelectTemplate(template.id, template.name);
      }
    };

    return (
      <button
        key={template.id}
        onClick={handleClick}
        className={cn(
          "w-full flex items-start gap-2.5 p-2.5 rounded-lg transition-all",
          "hover:bg-accent/50 border border-transparent hover:border-border/50",
          "text-left group",
          isActive && "bg-accent border-border"
        )}
      >
        <div className={cn("p-1.5 rounded-md shrink-0", bgColor)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{template.name}</p>
          {conversation && (
            <p className="text-[10px] text-muted-foreground truncate">
              {conversation.title}
            </p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="w-72 border-r bg-card/30 flex flex-col h-full">
      {/* Header with Template Manager */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Opções</p>
          <TemplateManager clientId={clientId} />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Templates de Conteúdo */}
          {filteredChatTemplates.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                Templates de Conteúdo
              </p>
              {filteredChatTemplates.map((template) => 
                renderTemplate(template, "chat")
              )}
            </div>
          )}

          {/* Templates de Imagem */}
          {filteredImageTemplates.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                Templates de Imagem
              </p>
              {filteredImageTemplates.map((template) => 
                renderTemplate(template, "image")
              )}
            </div>
          )}

          {/* Empty state */}
          {templatesLoading ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Carregando...
            </div>
          ) : chatTemplates.length === 0 && imageTemplates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs px-4">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum template criado</p>
              <p className="text-[10px] mt-1">Clique em "Gerenciar" para criar</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
