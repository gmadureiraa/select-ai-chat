import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Columns, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface SplitViewItem {
  id: string;
  title: string;
  content: string;
  type: string;
  source_url?: string;
  thumbnail_url?: string;
}

interface SplitViewPanelProps {
  items: SplitViewItem[];
  onClose: () => void;
  onRemoveItem: (id: string) => void;
}

export function SplitViewPanel({ items, onClose, onRemoveItem }: SplitViewPanelProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (items.length === 0) return null;

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      note: "bg-yellow-500",
      text: "bg-blue-500",
      youtube: "bg-red-500",
      link: "bg-green-500",
      image: "bg-orange-500",
      pdf: "bg-rose-500",
      audio: "bg-pink-500",
    };
    return colors[type] || "bg-gray-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-5xl"
    >
      <div className="bg-card/95 backdrop-blur-xl rounded-xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Columns className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Split View</span>
            <span className="text-xs text-muted-foreground">
              ({items.length} {items.length === 1 ? "item" : "itens"})
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Grid */}
        <div 
          className={cn(
            "grid gap-4 p-4",
            items.length === 1 && "grid-cols-1",
            items.length === 2 && "grid-cols-2",
            items.length >= 3 && "grid-cols-3"
          )}
          style={{ maxHeight: "60vh" }}
        >
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "bg-background rounded-lg border border-border overflow-hidden",
                  expandedItem === item.id && "col-span-full row-span-2"
                )}
              >
                {/* Item Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full", getTypeColor(item.type))} />
                    <span className="text-xs font-medium truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                    >
                      {expandedItem === item.id ? (
                        <Minimize2 className="h-3 w-3" />
                      ) : (
                        <Maximize2 className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Item Content */}
                <ScrollArea className={cn(
                  expandedItem === item.id ? "h-[400px]" : "h-[200px]"
                )}>
                  <div className="p-3">
                    {/* Image/Thumbnail */}
                    {(item.source_url || item.thumbnail_url) && item.type === "image" && (
                      <img
                        src={item.source_url || item.thumbnail_url}
                        alt={item.title}
                        className="w-full h-auto rounded-md mb-3"
                      />
                    )}

                    {/* YouTube Thumbnail */}
                    {item.type === "youtube" && item.thumbnail_url && (
                      <div className="relative mb-3">
                        <img
                          src={item.thumbnail_url}
                          alt={item.title}
                          className="w-full h-auto rounded-md"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                            <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Text Content */}
                    {item.content && (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-sm font-bold mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xs font-semibold mb-1">{children}</h2>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                            code: ({ children }) => <code className="bg-muted px-1 rounded text-[10px]">{children}</code>,
                          }}
                        >
                          {expandedItem === item.id ? item.content : item.content.slice(0, 500)}
                        </ReactMarkdown>
                        {!expandedItem && item.content.length > 500 && (
                          <span className="text-muted-foreground">...</span>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 text-center">
          <span className="text-[10px] text-muted-foreground">
            Selecione itens no canvas para adicionar ao Split View
          </span>
        </div>
      </div>
    </motion.div>
  );
}
