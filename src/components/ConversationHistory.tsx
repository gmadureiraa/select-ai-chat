import { memo } from "react";
import { MessageSquare, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SkeletonList } from "@/components/ui/skeleton-list";

interface ConversationHistoryProps {
  clientId: string;
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export const ConversationHistory = memo(function ConversationHistory({
  clientId,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationHistoryProps) {
  const { data: conversations, isLoading } = useConversationHistory(clientId);

  if (isLoading) {
    return (
      <div className="p-4">
        <SkeletonList count={3} height="h-16" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button
          onClick={onNewConversation}
          className="w-full"
          variant="default"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Conversa
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations && conversations.length > 0 ? (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors hover:bg-muted/50 ${
                  currentConversationId === conv.id
                    ? "bg-primary/10 border border-primary/20"
                    : "border border-transparent"
                }`}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.updated_at || conv.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma conversa ainda</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

ConversationHistory.displayName = 'ConversationHistory';
