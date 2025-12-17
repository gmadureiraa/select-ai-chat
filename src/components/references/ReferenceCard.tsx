import { ReferenceItem } from "@/hooks/useReferenceLibrary";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, ExternalLink, ImageIcon } from "lucide-react";
import { getContentTypeLabel } from "@/types/contentTypes";

interface ReferenceCardProps {
  reference: ReferenceItem;
  onEdit: (reference: ReferenceItem) => void;
  onDelete: (id: string) => void;
  onView: (reference: ReferenceItem) => void;
}

// Clean markdown and page separators from content for preview
const cleanContentForPreview = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/---\s*(PÁGINA|SLIDE|PAGE)\s*\d+\s*---/gi, "") // Remove page separators
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown
    .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown
    .replace(/#{1,6}\s/g, "") // Remove headers
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Remove images
    .replace(/^\s*[-*+]\s/gm, "") // Remove list markers
    .replace(/^\s*\d+\.\s/gm, "") // Remove numbered list markers
    .replace(/\n{2,}/g, " ") // Replace multiple newlines with space
    .replace(/\n/g, " ") // Replace single newlines with space
    .trim();
};

// Get the first image from reference metadata
const getPreviewImage = (reference: ReferenceItem): string | null => {
  // Check thumbnail_url first
  if (reference.thumbnail_url) return reference.thumbnail_url;
  
  // Check metadata for image_urls
  if (reference.metadata && typeof reference.metadata === 'object') {
    const meta = reference.metadata as any;
    if (meta.image_urls && Array.isArray(meta.image_urls) && meta.image_urls.length > 0) {
      return meta.image_urls[0];
    }
    if (meta.images && Array.isArray(meta.images) && meta.images.length > 0) {
      return meta.images[0];
    }
  }
  
  return null;
};

export function ReferenceCard({ reference, onEdit, onDelete, onView }: ReferenceCardProps) {
  const cleanedContent = cleanContentForPreview(reference.content);
  const previewImage = getPreviewImage(reference);
  
  return (
    <Card className="bg-card/50 border-border/50 hover:border-border transition-all h-[280px] flex flex-col group cursor-pointer overflow-hidden" onClick={() => onView(reference)}>
      {/* Image Preview */}
      {previewImage ? (
        <div className="relative h-[100px] bg-muted overflow-hidden shrink-0">
          <img 
            src={previewImage} 
            alt={reference.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken images
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background/80 backdrop-blur-sm">
              {getContentTypeLabel(reference.reference_type)}
            </Badge>
          </div>
        </div>
      ) : (
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium line-clamp-2 flex-1">{reference.title}</CardTitle>
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
              {getContentTypeLabel(reference.reference_type)}
            </Badge>
          </div>
        </CardHeader>
      )}
      
      <div className={`flex flex-col flex-1 ${previewImage ? 'p-3' : ''}`}>
        {previewImage && (
          <h3 className="text-sm font-medium line-clamp-2 mb-1">{reference.title}</h3>
        )}
        <CardContent className={`flex-1 ${previewImage ? 'p-0' : 'py-0'}`}>
          <p className="text-xs text-muted-foreground line-clamp-3">
            {cleanedContent}
          </p>
          {reference.source_url && (
            <a
              href={reference.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-2"
            >
              <ExternalLink className="h-3 w-3" />
              Ver fonte
            </a>
          )}
        </CardContent>
        <CardFooter className={`flex justify-end gap-1 pt-3 pb-3 border-t mt-auto ${previewImage ? 'px-0' : ''}`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onView(reference);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(reference);
            }}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(reference.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
}
