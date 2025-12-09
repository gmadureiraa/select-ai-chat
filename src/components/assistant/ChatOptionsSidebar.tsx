import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MessageCircle, 
  Lightbulb, 
  Sparkles, 
  FileText, 
  Image, 
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Settings,
  Plus,
  Library,
  BookOpen,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { TemplateManager } from "@/components/clients/TemplateManager";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatOptionsSidebarProps {
  clientId: string;
  currentConversationId: string | null;
  onSelectTemplate: (templateId: string | null, templateName?: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onSelectMode: (mode: "free_chat" | "ideas" | "content") => void;
}

const QUICK_MODES = [
  {
    id: "free_chat",
    name: "Chat Livre",
    description: "Perguntas e respostas sobre o cliente",
    icon: MessageCircle,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "ideas",
    name: "Gerar Ideias",
    description: "Brainstorm de ideias de conteúdo",
    icon: Lightbulb,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    id: "content",
    name: "Alta Qualidade",
    description: "Conteúdo com pipeline multi-agente",
    icon: Sparkles,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
];

export const ChatOptionsSidebar = ({ 
  clientId, 
  currentConversationId,
  onSelectTemplate,
  onSelectConversation,
  onSelectMode 
}: ChatOptionsSidebarProps) => {
  const { templates, isLoading: templatesLoading } = useClientTemplates(clientId);
  const { data: conversations } = useConversationHistory(clientId);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const chatTemplates = templates?.filter(t => t.type === "chat") || [];
  const imageTemplates = templates?.filter(t => t.type === "image") || [];

  const filteredChatTemplates = chatTemplates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredImageTemplates = imageTemplates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentConversations = conversations?.slice(0, 5) || [];

  const navigate = useNavigate();

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
          {/* Modos Rápidos */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
              Modos Rápidos
            </p>
            {QUICK_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id as "free_chat" | "ideas" | "content")}
                className={cn(
                  "w-full flex items-start gap-3 p-2.5 rounded-lg transition-all",
                  "hover:bg-accent/50 border border-transparent hover:border-border/50",
                  "text-left group"
                )}
              >
                <div className={cn("p-1.5 rounded-md shrink-0", mode.bgColor)}>
                  <mode.icon className={cn("h-4 w-4", mode.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{mode.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {mode.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Templates de Chat */}
          {filteredChatTemplates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                Templates de Conteúdo
              </p>
              {filteredChatTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template.id, template.name)}
                  className={cn(
                    "w-full flex items-start gap-3 p-2.5 rounded-lg transition-all",
                    "hover:bg-accent/50 border border-transparent hover:border-border/50",
                    "text-left group"
                  )}
                >
                  <div className="p-1.5 rounded-md shrink-0 bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {template.rules?.length || 0} regras
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Templates de Imagem */}
          {filteredImageTemplates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                Templates de Imagem
              </p>
              {filteredImageTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template.id, template.name)}
                  className={cn(
                    "w-full flex items-start gap-3 p-2.5 rounded-lg transition-all",
                    "hover:bg-accent/50 border border-transparent hover:border-border/50",
                    "text-left group"
                  )}
                >
                  <div className="p-1.5 rounded-md shrink-0 bg-pink-500/10">
                    <Image className="h-4 w-4 text-pink-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {template.rules?.length || 0} regras
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Histórico de Conversas */}
          {recentConversations.length > 0 && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between px-2 py-1 hover:bg-accent/30 rounded-md transition-colors">
                <div className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Histórico Recente
                  </p>
                </div>
                {historyOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1.5">
                {recentConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={cn(
                      "w-full flex items-start gap-2 p-2 rounded-lg transition-all text-left",
                      "hover:bg-accent/50 border border-transparent hover:border-border/50",
                      currentConversationId === conv.id && "bg-accent border-border"
                    )}
                  >
                    <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{conv.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.updated_at || conv.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Empty state */}
          {templatesLoading ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Carregando...
            </div>
          ) : chatTemplates.length === 0 && imageTemplates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs px-4">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum template</p>
              <p className="text-[10px] mt-1">Use os modos rápidos acima</p>
            </div>
          )}

          {/* Quick Links */}
          <div className="space-y-1.5 pt-2 border-t">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
              Recursos
            </p>
            <button
              onClick={() => navigate(`/client/${clientId}/content`)}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-accent/50 transition-colors"
            >
              <Library className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Biblioteca de Conteúdo</span>
            </button>
            <button
              onClick={() => navigate(`/client/${clientId}/references`)}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-accent/50 transition-colors"
            >
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Referências</span>
            </button>
            <button
              onClick={() => navigate(`/client/${clientId}/performance`)}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-accent/50 transition-colors"
            >
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Performance</span>
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
