import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Download, ChevronDown, Check, Plus, History, MessageSquare } from "lucide-react";
import { useTheme } from "next-themes";
import kaleidosLogoVerde from "@/assets/kaleidos-logo-verde.svg";
import kaleidosLogoRosa from "@/assets/kaleidos-logo-rosa.svg";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { exportToMarkdown, downloadFile } from "@/lib/exportConversation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Message } from "@/types/chat";
import type { KAIConversation } from "@/hooks/useKAIConversations";

interface ClientItem {
  id: string;
  name: string;
  avatar_url?: string;
}

interface GlobalKAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  selectedClientId?: string | null;
  selectedClientName?: string;
  clients?: ClientItem[];
  onClientChange?: (clientId: string) => void;
  onClearConversation?: () => void;
  messages?: Message[];
  // New conversation management props
  conversations?: KAIConversation[];
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: () => Promise<void>;
}

export function GlobalKAIPanel({
  isOpen,
  onClose,
  children,
  className,
  selectedClientId,
  selectedClientName,
  clients = [],
  onClientChange,
  onClearConversation,
  messages = [],
  // Conversation management
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: GlobalKAIPanelProps) {
  const { resolvedTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDeleteConversation = async () => {
    if (onDeleteConversation) {
      await onDeleteConversation();
    }
    setShowDeleteDialog(false);
  };

  const handleExport = async () => {
    if (messages.length === 0) {
      toast.error("Nenhuma mensagem para exportar");
      return;
    }

    try {
      const markdown = await exportToMarkdown(messages, selectedClientName || "kAI Chat");
      downloadFile(markdown, `kai-chat-${Date.now()}.md`, "text/markdown");
      toast.success("Conversa exportada!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar");
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const hasConversations = conversations.length > 0;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay - minimal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Panel - Clean, minimal design */}
            <motion.div
              ref={panelRef}
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ 
                type: "spring", 
                damping: 30, 
                stiffness: 350,
                mass: 0.8
              }}
              className={cn(
                "fixed right-0 top-0 z-50",
                "w-full sm:w-[400px] lg:w-[440px]",
                "h-screen max-h-screen",
                "bg-background border-l border-border",
                "flex flex-col overflow-hidden",
                className
              )}
            >
              {/* Minimal Header */}
              <div className="flex items-center justify-between h-14 px-4 border-b border-border">
                <div className="flex items-center gap-3 flex-1 min-w-0">
<div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
                    <img 
                      src={resolvedTheme === "dark" ? kaleidosLogoVerde : kaleidosLogoRosa} 
                      alt="kAI" 
                      className="h-6 w-6 object-contain" 
                    />
                  </div>
                  
                  {/* Client selector dropdown */}
                  {clients.length > 0 && onClientChange ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-auto p-1.5 gap-2 max-w-[200px]">
                          {selectedClient ? (
                            <>
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={selectedClient.avatar_url} />
                                <AvatarFallback className="text-[10px]">
                                  {selectedClient.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium truncate">{selectedClient.name}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Selecionar perfil</span>
                          )}
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {clients.map((client) => (
                          <DropdownMenuItem
                            key={client.id}
                            onClick={() => onClientChange(client.id)}
                            className="gap-2"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={client.avatar_url} />
                              <AvatarFallback className="text-[10px]">
                                {client.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate">{client.name}</span>
                            {client.id === selectedClientId && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground">kAI</span>
                      {selectedClientName && (
                        <span className="text-xs text-muted-foreground truncate">
                          {selectedClientName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* New conversation button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={onNewConversation}
                    title="Nova conversa"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  {/* Conversation history dropdown */}
                  {hasConversations && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Histórico de conversas"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Conversas anteriores
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {conversations.slice(0, 10).map((conv) => (
                          <DropdownMenuItem
                            key={conv.id}
                            onClick={() => onSelectConversation?.(conv.id)}
                            className={cn(
                              "flex items-start gap-2 py-2 cursor-pointer",
                              conv.id === activeConversationId && "bg-accent"
                            )}
                          >
                            <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {conv.title || "Nova conversa"}
                              </p>
                              {conv.last_message_preview && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {conv.last_message_preview}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                {formatDistanceToNow(new Date(conv.updated_at), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </p>
                            </div>
                            {conv.id === activeConversationId && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Export button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={handleExport}
                    disabled={messages.length === 0}
                    title="Exportar conversa"
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {/* Delete conversation button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={messages.length === 0}
                    title="Apagar conversa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <DropdownMenuSeparator className="h-6 w-px bg-border mx-1" />

                  {/* Close button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente esta conversa e todas as suas mensagens. Isso não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
