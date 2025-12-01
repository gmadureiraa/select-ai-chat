import { Trash2, Youtube, FileText, Link as LinkIcon, Image as ImageIcon, Music, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResearchItem } from "@/hooks/useResearchItems";

interface ResearchItemCardProps {
  item: ResearchItem;
  onDelete: (id: string) => void;
}

export const ResearchItemCard = ({ item, onDelete }: ResearchItemCardProps) => {
  const getIcon = () => {
    switch (item.type) {
      case "youtube": return <Youtube className="h-4 w-4" />;
      case "text": return <FileText className="h-4 w-4" />;
      case "link": return <LinkIcon className="h-4 w-4" />;
      case "image": return <ImageIcon className="h-4 w-4" />;
      case "audio": return <Music className="h-4 w-4" />;
      case "pdf": return <FileType className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case "youtube": return "YouTube";
      case "text": return "Texto";
      case "link": return "Link";
      case "image": return "Imagem";
      case "audio": return "Áudio";
      case "pdf": return "PDF";
      default: return item.type;
    }
  };

  return (
    <Card className="p-4 relative group">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{getTypeLabel()}</Badge>
            {item.processed && <Badge variant="secondary">Processado</Badge>}
          </div>
          <h3 className="font-semibold text-sm truncate">{item.title || "Sem título"}</h3>
          {item.content && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{item.content}</p>
          )}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-2 block truncate"
            >
              {item.source_url}
            </a>
          )}
        </div>
      </div>

      {item.thumbnail_url && (
        <img
          src={item.thumbnail_url}
          alt={item.title || "Thumbnail"}
          className="w-full h-32 object-cover rounded mt-3"
        />
      )}
    </Card>
  );
};
