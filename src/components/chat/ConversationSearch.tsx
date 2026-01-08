import { useState, useCallback } from "react";
import { Search, X, MessageSquare, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConversationSearch } from "@/hooks/useConversationSearch";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ConversationSearchProps {
  clientId: string;
  onSelectConversation: (conversationId: string) => void;
}

export const ConversationSearch = ({
  clientId,
  onSelectConversation,
}: ConversationSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { results, isSearching, search, clearSearch } = useConversationSearch(clientId);

  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value);
      if (value.length >= 3) {
        search(value);
      }
    },
    [search]
  );

  const handleSelect = (conversationId: string) => {
    onSelectConversation(conversationId);
    setIsOpen(false);
    setInputValue("");
    clearSearch();
  };

  const handleClear = () => {
    setInputValue("");
    clearSearch();
  };

  const highlightText = (text: string, query: string) => {
    if (!query || query.length < 3) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <Search className="h-4 w-4" />
          Buscar em conversas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Buscar em Conversas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite pelo menos 3 caracteres para buscar..."
              value={inputValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {inputValue && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ScrollArea className="h-[400px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : inputValue.length < 3 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Digite pelo menos 3 caracteres</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum resultado encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((result) => (
                  <button
                    key={result.message_id}
                    onClick={() => handleSelect(result.conversation_id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      "hover:bg-accent hover:border-primary/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">
                          {result.conversation_title}
                        </p>
                        <p className="text-sm line-clamp-2">
                          {highlightText(result.content, inputValue)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(result.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
