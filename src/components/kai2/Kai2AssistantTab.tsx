import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, PanelLeftClose, PanelLeft, History, MessageSquare, Sparkles, Zap, FileText, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { useClientChat } from "@/hooks/useClientChat";
import { useChatWorkflows } from "@/hooks/useChatWorkflows";
import { useContentLibrary } from "@/hooks/useContentLibrary";
import { useReferenceLibrary } from "@/hooks/useReferenceLibrary";
import { FloatingInput, ChatMode } from "@/components/chat/FloatingInput";
import { Citation } from "@/components/chat/CitationChip";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { QuickSuggestions } from "@/components/chat/QuickSuggestions";
import { WorkflowExecutionCard } from "@/components/chat/WorkflowExecutionCard";
import { TemplateManager } from "@/components/clients/TemplateManager";
import { TasksPanel } from "@/components/kai2/TasksPanel";
import { ConversationHistorySidebar } from "@/components/kai2/ConversationHistorySidebar";
import { ActiveAgentBadge } from "@/components/chat/ActiveAgentBadge";
import { useContextualTasks } from "@/hooks/useContextualTasks";
import { ContextType } from "@/config/contextualTasks";
import { Client } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import KaleidosLogo from "@/assets/kaleidos-logo.svg";
import { supabase } from "@/integrations/supabase/client";

interface Kai2AssistantTabProps {
  clientId: string;
  client: Client;
  initialMessage?: string;
  initialContentType?: string;
  onInitialMessageSent?: () => void;
}

// Map content types from GradientHero to template names
const CONTENT_TYPE_TO_TEMPLATE_NAME: Record<string, string[]> = {
  "text": ["Tweet", "Thread", "Tweet/Thread"],
  "carousel": ["Carrossel", "Carousel", "Carrossel Instagram"],
  "video": ["Roteiro", "Reels", "Roteiro de Vídeo", "Script"],
  "newsletter": ["Newsletter"],
  "image": [], // Image templates are handled separately
};

export const Kai2AssistantTab = ({ 
  clientId, 
  client, 
  initialMessage,
  initialContentType,
  onInitialMessageSent 
}: Kai2AssistantTabProps) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    // If coming from hero with content type, don't use URL template
    initialContentType ? null : searchParams.get("template")
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"templates" | "history">("templates");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialMessageSentRef = useRef(false);
  const templateSelectedRef = useRef(false);

  const { templates, isLoading: isLoadingTemplates } = useClientTemplates(clientId);
  const { contents: contentLibrary } = useContentLibrary(clientId);
  const { references: referenceLibrary } = useReferenceLibrary(clientId);
  
  // Find matching template based on content type from GradientHero
  useEffect(() => {
    if (initialContentType && templates && templates.length > 0 && !templateSelectedRef.current) {
      templateSelectedRef.current = true;
      
      // Check if it's an image type - find image template
      if (initialContentType === "image") {
        const imageTemplate = templates.find(t => t.type === "image");
        if (imageTemplate) {
          setSelectedTemplateId(imageTemplate.id);
          // Update URL
          setSearchParams(prev => {
            prev.set("template", imageTemplate.id);
            return prev;
          });
          return;
        }
      }
      
      // Find matching chat template by name - more flexible matching
      const possibleNames = CONTENT_TYPE_TO_TEMPLATE_NAME[initialContentType] || [];
      const matchingTemplate = templates.find(t => 
        t.type === "chat" && possibleNames.some(name => {
          const templateNameLower = t.name.toLowerCase();
          const searchNameLower = name.toLowerCase();
          return templateNameLower.includes(searchNameLower) || searchNameLower.includes(templateNameLower);
        })
      );
      
      if (matchingTemplate) {
        setSelectedTemplateId(matchingTemplate.id);
        // Update URL
        setSearchParams(prev => {
          prev.set("template", matchingTemplate.id);
          return prev;
        });
      } else {
        // No matching template found - use free chat (null)
        setSelectedTemplateId(null);
        // Clear template from URL
        setSearchParams(prev => {
          prev.delete("template");
          return prev;
        });
      }
    }
  }, [initialContentType, templates, setSearchParams]);

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  const {
    messages,
    isLoading,
    sendMessage,
    clearConversation,
    conversationId,
    currentStep,
    multiAgentStep,
  } = useClientChat(clientId, selectedTemplateId || undefined);

  // Workflow integration
  const {
    workflows,
    executionState: workflowExecutionState,
    detectListWorkflowsRequest,
    detectWorkflowRequest,
    executeWorkflow,
    formatWorkflowsList,
    resetExecution: resetWorkflowExecution,
  } = useChatWorkflows();

  // Contextual tasks
  const {
    tasks,
    isActive: tasksActive,
    startTasks,
    advanceToTask,
    completeTask,
    completeAllTasks,
    reset: resetTasks,
  } = useContextualTasks();

  // Determine context type based on template
  const getContextType = (): ContextType => {
    if (!selectedTemplate) return "assistant-simple";
    if (selectedTemplate.type === "image") return "assistant-simple";
    // Check if multi-agent based on template rules
    const rules = selectedTemplate.rules as any;
    if (rules?.useMultiAgent) return "assistant-multi-agent";
    return "assistant-library";
  };

  // Simulate task progression based on loading state and steps
  useEffect(() => {
    if (isLoading && !tasksActive) {
      startTasks(getContextType());
    } else if (isLoading && tasksActive) {
      // Advance tasks based on currentStep or multiAgentStep
      if (multiAgentStep) {
        const stepMap: Record<string, string> = {
          "researcher": "agent-researcher",
          "writer": "agent-writer",
          "editor": "agent-editor",
          "reviewer": "agent-reviewer",
        };
        const taskId = stepMap[multiAgentStep];
        if (taskId) advanceToTask(taskId);
      } else if (currentStep) {
        const stepMap: Record<string, string> = {
          "analyzing": "analyze",
          "searching": "search-library",
          "generating": "generate",
          "formatting": "format",
        };
        const taskId = stepMap[currentStep] || "generate";
        advanceToTask(taskId);
      }
    } else if (!isLoading && tasksActive) {
      completeAllTasks();
    }
  }, [isLoading, currentStep, multiAgentStep, tasksActive]);

  // Handle initial message from hero - wait for conversationId to be ready
  useEffect(() => {
    if (initialMessage && !initialMessageSentRef.current && !isLoading && conversationId) {
      initialMessageSentRef.current = true;
      sendMessage(initialMessage).then(() => {
        onInitialMessageSent?.();
      });
    }
  }, [initialMessage, isLoading, sendMessage, onInitialMessageSent, conversationId]);

  // Update URL when template changes
  useEffect(() => {
    if (selectedTemplateId) {
      setSearchParams(prev => {
        prev.set("template", selectedTemplateId);
        return prev;
      });
    } else {
      setSearchParams(prev => {
        prev.delete("template");
        return prev;
      });
    }
  }, [selectedTemplateId, setSearchParams]);

  // Scroll to bottom function
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? "smooth" : "auto",
        block: "end" 
      });
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // Initial scroll on mount/template change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedTemplateId, scrollToBottom]);

  const handleSend = async (content: string, images?: string[], quality?: "fast" | "high", mode?: ChatMode, citations?: Citation[]) => {
    if (!content.trim() && (!images || images.length === 0)) return;
    
    // Check for workflow commands first
    if (detectListWorkflowsRequest(content)) {
      // Save user message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
      });
      
      // Generate workflow list response
      const workflowList = formatWorkflowsList();
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: workflowList,
      });
      
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      return;
    }
    
    // Check for workflow execution request
    const workflowMatch = detectWorkflowRequest(content);
    if (workflowMatch) {
      // Save user message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
      });
      
      // Execute workflow
      const result = await executeWorkflow(
        workflowMatch.id, 
        content,
        clientId,
        { name: client.name, description: client.description }
      );
      
      // Save result as assistant message
      const responseContent = result.success 
        ? `## Workflow "${workflowMatch.name}" executado com sucesso!\n\n${result.result}`
        : `## Erro ao executar workflow "${workflowMatch.name}"\n\n${result.error}`;
      
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: responseContent,
      });
      
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      return;
    }
    
    // Regular message handling - pass citations to sendMessage
    await sendMessage(content, images, quality, mode, citations);
  };

  const handleClearConversation = async () => {
    await clearConversation();
    resetWorkflowExecution();
  };

  const chatTemplates = templates?.filter(t => t.type === "chat") || [];
  const imageTemplates = templates?.filter(t => t.type === "image") || [];

  const templateType = !selectedTemplate ? "free_chat" : 
                       selectedTemplate.type === "image" ? "image" : "content";

  return (
    <div className="flex h-full relative">
      {/* Collapsible Sidebar - Templates & History */}
      <div
        className={cn(
          "shrink-0 flex flex-col border-r border-border/30 bg-card/30 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-60"
        )}
      >
        {/* Sidebar Header with Tabs */}
        <div className="border-b border-border/30">
          <div className="px-2 pt-2 pb-1">
            <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as "templates" | "history")}>
              <TabsList className="w-full h-8 p-0.5">
                <TabsTrigger value="templates" className="flex-1 h-7 text-xs gap-1.5">
                  <FileText className="h-3 w-3" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 h-7 text-xs gap-1.5">
                  <History className="h-3 w-3" />
                  Histórico
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="px-3 pb-2 flex items-center justify-between">
            {sidebarTab === "templates" && <TemplateManager clientId={clientId} />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(true)}
              className="h-7 w-7 hover:bg-muted/50 ml-auto"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Templates Tab */}
        {sidebarTab === "templates" && (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {/* Free Chat Option */}
              <button
                className={cn(
                  "w-full flex items-center gap-2 text-left text-sm py-2 px-3 rounded-md transition-colors",
                  !selectedTemplateId 
                    ? "bg-primary/10 text-primary border-l-2 border-primary" 
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
                onClick={() => setSelectedTemplateId(null)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat Livre
              </button>

              {/* Content Templates */}
              {chatTemplates.length > 0 && (
                <div className="pt-3">
                  <p className="text-[10px] text-muted-foreground/40 px-3 py-1 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Conteúdo
                    <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1">
                      {chatTemplates.length}
                    </Badge>
                  </p>
                  {chatTemplates.map((template) => (
                    <button
                      key={template.id}
                      className={cn(
                        "w-full text-left text-sm py-2 px-3 rounded-md transition-colors",
                        selectedTemplateId === template.id
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      )}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Image Templates */}
              {imageTemplates.length > 0 && (
                <div className="pt-3">
                  <p className="text-[10px] text-muted-foreground/40 px-3 py-1 font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="h-3 w-3" />
                    Imagens
                    <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1">
                      {imageTemplates.length}
                    </Badge>
                  </p>
                  {imageTemplates.map((template) => (
                    <button
                      key={template.id}
                      className={cn(
                        "w-full text-left text-sm py-2 px-3 rounded-md transition-colors",
                        selectedTemplateId === template.id
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      )}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* History Tab */}
        {sidebarTab === "history" && (
          <ConversationHistorySidebar
            clientId={clientId}
            currentConversationId={conversationId}
            onSelectConversation={(id, templateId) => {
              if (templateId) {
                setSelectedTemplateId(templateId);
              }
              // Note: We'd need to implement conversation loading here
            }}
          />
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50">
        {/* Collapsed Sidebar Toggle + Context Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
          {sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(false)}
              className="h-8 w-8 hover:bg-muted/50"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedTemplate ? (
              <ActiveAgentBadge templateName={selectedTemplate.name} showDetails />
            ) : (
              <span className="text-sm font-medium text-foreground/80 truncate">
                Chat Livre
              </span>
            )}
            <span className="text-muted-foreground/40">•</span>
            <span className="text-xs text-muted-foreground truncate">{client.name}</span>
          </div>
          {conversationId && messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearConversation}
              className="text-muted-foreground hover:text-destructive h-7 px-2 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Limpar</span>
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="min-h-full flex flex-col">
            {messages.length === 0 && !initialMessage ? (
              /* Empty State - Centered, Minimal */
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-5">
                  <img src={KaleidosLogo} alt="kAI" className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold mb-1.5 text-center text-foreground/90">
                  {selectedTemplate ? `${selectedTemplate.name}` : "Como posso ajudar?"}
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                  {selectedTemplate
                    ? `Gere conteúdo otimizado para ${client.name}`
                    : `Converse sobre ${client.name}, analise dados ou explore ideias`
                  }
                </p>
                
                {/* Quick Suggestions */}
                <QuickSuggestions 
                  onSelect={(suggestion) => handleSend(suggestion)}
                  clientName={client.name}
                  isContentTemplate={!!selectedTemplate}
                />
              </div>
            ) : (
              <div className="space-y-1 px-4 py-6 max-w-3xl mx-auto w-full">
                {messages.map((message) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    role={message.role as "user" | "assistant"}
                    content={message.content}
                    imageUrls={message.image_urls}
                    clientId={clientId}
                    clientName={client.name}
                  />
                ))}

                {/* Workflow Execution Status */}
                {workflowExecutionState.isExecuting && workflowExecutionState.workflowName && (
                  <div className="mx-auto max-w-md">
                    <WorkflowExecutionCard
                      workflowName={workflowExecutionState.workflowName}
                      status={workflowExecutionState.status}
                      result={workflowExecutionState.result}
                      error={workflowExecutionState.error}
                    />
                  </div>
                )}

                {isLoading && !workflowExecutionState.isExecuting && (
                  <TasksPanel 
                    tasks={tasks}
                    isActive={tasksActive}
                    className="mx-auto max-w-md"
                  />
                )}
                
                {/* Scroll anchor */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Floating Input - Bottom */}
        <div className="border-t border-border/10 bg-background/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <FloatingInput
              onSend={handleSend}
              disabled={isLoading}
              templateType={templateType}
              placeholder={selectedTemplate ? `Criar ${selectedTemplate.name}...` : "Pergunte sobre o cliente..."}
              contentLibrary={contentLibrary}
              referenceLibrary={referenceLibrary}
            />
          </div>
        </div>
      </div>
    </div>
  );
};