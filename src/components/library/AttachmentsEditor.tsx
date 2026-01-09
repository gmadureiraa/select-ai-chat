import { useState } from "react";
import { X, FileText, Video, Music, File, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AttachedItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'video' | 'audio' | 'document';
  size?: number;
}

interface AttachmentsEditorProps {
  attachments: AttachedItem[];
  onRemove: (id: string) => void;
  className?: string;
  readOnly?: boolean;
}

export function AttachmentsEditor({ 
  attachments, 
  onRemove, 
  className,
  readOnly = false 
}: AttachmentsEditorProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const getIcon = (type: AttachedItem['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'video':
        return <Video className="h-5 w-5 text-purple-500" />;
      case 'audio':
        return <Music className="h-5 w-5 text-green-500" />;
      default:
        return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Anexos ({attachments.length})
          </span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="relative group border rounded-lg overflow-hidden bg-muted/30"
            >
              {item.type === 'image' ? (
                <div className="relative aspect-square">
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setExpandedImage(item.url)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setExpandedImage(item.url)}
                  >
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 aspect-square hover:bg-muted/50 transition-colors"
                >
                  {getIcon(item.type)}
                  <span className="text-xs text-center mt-2 line-clamp-2 text-muted-foreground">
                    {item.name}
                  </span>
                </a>
              )}
              
              {!readOnly && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemove(item.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox para expandir imagens */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/90 border-none">
          {expandedImage && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={expandedImage}
                alt="Imagem expandida"
                className="max-w-full max-h-[85vh] object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20"
                onClick={() => setExpandedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
