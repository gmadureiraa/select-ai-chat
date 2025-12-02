import { useState, useCallback, useEffect } from "react";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause,
  Maximize2,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResearchItem } from "@/hooks/useResearchItems";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface PresentationModeProps {
  items: ResearchItem[];
  onClose: () => void;
}

const typeLabels: Record<string, string> = {
  ai_chat: "Chat IA",
  comparison: "Comparação",
  note: "Nota",
  text: "Texto",
  youtube: "YouTube",
  link: "Link",
  pdf: "PDF",
  embed: "Embed",
  spreadsheet: "Planilha",
  audio: "Áudio",
  image: "Imagem",
  content_library: "Biblioteca de Conteúdo",
  reference_library: "Biblioteca de Referências",
  group: "Grupo",
};

export const PresentationMode = ({ items, onClose }: PresentationModeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Filter items that have content to present
  const presentableItems = items.filter(item => 
    item.title || item.content || item.source_url || item.thumbnail_url
  );

  const currentItem = presentableItems[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex(prev => 
      prev < presentableItems.length - 1 ? prev + 1 : prev
    );
  }, [presentableItems.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : prev);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, onClose]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev < presentableItems.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [isPlaying, presentableItems.length]);

  if (presentableItems.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">
            Nenhum item para apresentar
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      {/* Sidebar */}
      <div
        className={cn(
          "h-full bg-card border-r transition-all duration-300",
          showSidebar ? "w-64" : "w-0"
        )}
      >
        {showSidebar && (
          <ScrollArea className="h-full p-4">
            <h3 className="font-semibold mb-4">Slides</h3>
            <div className="space-y-2">
              {presentableItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "w-full text-left p-2 rounded-lg transition-all",
                    index === currentIndex
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    {index + 1}. {typeLabels[item.type] || item.type}
                  </div>
                  <div className="text-sm truncate">
                    {item.title || "Sem título"}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <List className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="font-semibold">
                {currentItem?.title || "Sem título"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {typeLabels[currentItem?.type || ""] || currentItem?.type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {presentableItems.length}
            </span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Slide content */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div className="max-w-4xl w-full">
            {/* Thumbnail/Image */}
            {currentItem?.thumbnail_url && (
              <div className="mb-6 flex justify-center">
                <img
                  src={currentItem.thumbnail_url}
                  alt={currentItem.title || ""}
                  className="max-h-64 rounded-lg shadow-lg"
                />
              </div>
            )}

            {/* Title */}
            {currentItem?.title && (
              <h1 className="text-3xl font-bold mb-4 text-center">
                {currentItem.title}
              </h1>
            )}

            {/* Source URL */}
            {currentItem?.source_url && (
              <p className="text-sm text-muted-foreground text-center mb-6">
                <a 
                  href={currentItem.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {currentItem.source_url}
                </a>
              </p>
            )}

            {/* Content */}
            {currentItem?.content && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{currentItem.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-center gap-4 p-4 border-t">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={goNext}
            disabled={currentIndex === presentableItems.length - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
