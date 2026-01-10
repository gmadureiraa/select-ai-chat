import { memo, useCallback, KeyboardEvent } from "react";
import { ReferenceItem } from "@/hooks/useReferenceLibrary";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, ExternalLink } from "lucide-react";
import { getContentTypeLabel } from "@/types/contentTypes";
import { getPublicUrl } from "@/lib/storage";
import { cleanContentForPreview } from "@/lib/text-utils";

interface ReferenceCardProps {
  reference: ReferenceItem;
  onEdit: (reference: ReferenceItem) => void;
  onDelete: (id: string) => void;
  onView: (reference: ReferenceItem) => void;
  canDelete?: boolean;
  canEdit?: boolean;
}

// Get the first image URL from reference metadata
const getPreviewImageUrl = (reference: ReferenceItem): string | null => {
  if (reference.thumbnail_url) return getPublicUrl(reference.thumbnail_url);
  
  if (reference.metadata && typeof reference.metadata === 'object') {
    const meta = reference.metadata as Record<string, unknown>;
    if (meta.image_urls && Array.isArray(meta.image_urls) && meta.image_urls.length > 0) {
      return getPublicUrl(meta.image_urls[0]);
    }
    if (meta.images && Array.isArray(meta.images) && meta.images.length > 0) {
      return getPublicUrl(meta.images[0]);
    }
    // Check attachments for images
    if (meta.attachments && Array.isArray(meta.attachments)) {
      const firstImage = meta.attachments.find((a: any) => a.type === 'image');
      if (firstImage?.url) return firstImage.url;
    }
  }
  
  return null;
};

export const ReferenceCard = memo(function ReferenceCard({ reference, onEdit, onDelete, onView, canDelete = true, canEdit = true }: ReferenceCardProps) {
  const cleanedContent = cleanContentForPreview(reference.content);
  const imageUrl = getPreviewImageUrl(reference);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onView(reference);
    }
  }, [reference, onView]);
  
  return (
    <Card 
      className="bg-card/50 border-border/50 hover:border-border transition-all h-[280px] flex flex-col group cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
      onClick={() => onView(reference)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Ver referência: ${reference.title}`}
    >
      {/* Image Preview */}
      {imageUrl ? (
        <div className="relative h-[100px] bg-muted overflow-hidden shrink-0">
          <img 
            src={imageUrl} 
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
      
      <div className={`flex flex-col flex-1 ${imageUrl ? 'p-3' : ''}`}>
        {imageUrl && (
          <h3 className="text-sm font-medium line-clamp-2 mb-1">{reference.title}</h3>
        )}
        <CardContent className={`flex-1 ${imageUrl ? 'p-0' : 'py-0'}`}>
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
        <CardFooter className={`flex justify-end gap-1 pt-3 pb-3 border-t mt-auto ${imageUrl ? 'px-0' : ''}`}>
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
          {canEdit && (
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
          )}
          {canDelete && (
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
          )}
        </CardFooter>
      </div>
    </Card>
  );
});
