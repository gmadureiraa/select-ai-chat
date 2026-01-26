import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, useNodes, useEdges } from 'reactflow';
import { MessageSquare, Send, Plus, Trash2, FileText, Loader2, Link2, Link2Off, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useMaterialChat, MaterialChatMessage } from '@/hooks/useMaterialChat';

interface MaterialChatNodeData {
  messages?: MaterialChatMessage[];
  connectedMaterialId?: string;
  onUpdateData?: (data: Partial<MaterialChatNodeData>) => void;
  onDelete?: () => void;
  onCreateNode?: (content: string, position: { x: number; y: number }) => void;
  clientId: string;
}

interface MaterialChatNodeProps {
  id: string;
  data: MaterialChatNodeData;
  selected?: boolean;
}

function MaterialChatNodeComponent({ id, data, selected }: MaterialChatNodeProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getNode } = useReactFlow();
  const nodes = useNodes();
  const edges = useEdges();

  // Find connected material
  const connectedEdge = edges.find(e => e.target === id);
  const connectedNode = connectedEdge ? getNode(connectedEdge.source) : null;
  
  // Extract material context from connected node
  const materialContext = connectedNode?.data?.output?.content || '';
  const materialTitle = connectedNode?.data?.output?.libraryTitle || 
                        connectedNode?.data?.output?.fileName || 
                        'Material';
  const materialPreview = materialContext.slice(0, 150) + (materialContext.length > 150 ? '...' : '');

  const isConnected = !!materialContext;

  const { messages, isLoading, error, sendMessage, setMessages, clearError } = useMaterialChat({
    clientId: data.clientId,
    materialContext,
    materialTitle,
  });

  // Sync messages with node data for persistence
  useEffect(() => {
    if (data.messages && data.messages.length > 0 && messages.length === 0) {
      setMessages(data.messages);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      data.onUpdateData?.({ messages });
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    if (!materialContext) {
      return;
    }
    sendMessage(inputValue);
    setInputValue('');
  }, [inputValue, isLoading, materialContext, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateNode = (content: string) => {
    const node = getNode(id);
    if (node && data.onCreateNode) {
      data.onCreateNode(content, {
        x: node.position.x + 420,
        y: node.position.y,
      });
    }
  };

  const handleRetry = (messageContent: string) => {
    clearError();
    // Remove the error message and resend
    setMessages(prev => prev.filter(m => !m.isError));
    sendMessage(messageContent);
  };

  return (
    <div 
      className={cn(
        "bg-card border rounded-xl shadow-lg w-[400px] overflow-hidden",
        selected && "ring-2 ring-primary"
      )}
    >
      {/* Header with connection status */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Chat sobre Material</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Connection indicator */}
          <div 
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
              isConnected 
                ? "bg-primary/10 text-primary" 
                : "bg-muted text-muted-foreground"
            )}
          >
            {isConnected ? (
              <>
                <Link2 className="h-3 w-3" />
                <span>Conectado</span>
              </>
            ) : (
              <>
                <Link2Off className="h-3 w-3" />
                <span>Desconectado</span>
              </>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={data.onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Connected Material Preview */}
      <div className={cn(
        "px-3 py-2 border-b transition-colors",
        isConnected ? "bg-primary/5" : "bg-muted/30"
      )}>
        {materialContext ? (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{materialTitle}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{materialPreview}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-center py-1">
            <Link2Off className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Conecte um nó de Anexo para começar
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="h-[280px]" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.length === 0 && materialContext && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Pergunte algo sobre o material conectado
            </p>
          )}
          
          {messages.map((msg, index) => (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col gap-1",
                msg.role === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <div 
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[90%] text-sm",
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : msg.isError
                      ? 'bg-destructive/10 text-destructive border border-destructive/20'
                      : 'bg-muted'
                )}
              >
                {msg.isError ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{msg.content}</span>
                  </div>
                ) : msg.content ? (
                  msg.content
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
              
              {/* Error retry button */}
              {msg.isError && index > 0 && messages[index - 1]?.role === 'user' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleRetry(messages[index - 1].content)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Tentar novamente
                </Button>
              )}
              
              {/* Add to canvas button for assistant messages */}
              {msg.role === 'assistant' && msg.content && !msg.isError && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleCreateNode(msg.content)}
                >
                  <Plus className="h-3 w-3" />
                  Adicionar ao Canvas
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={materialContext ? "Pergunte sobre o material..." : "Conecte um material primeiro"}
            disabled={!materialContext || isLoading}
            className="text-sm h-9"
          />
          <Button 
            size="icon" 
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!materialContext || !inputValue.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="material-input"
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

export const MaterialChatNode = memo(MaterialChatNodeComponent);
