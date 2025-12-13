import { ReferenceItem } from "@/hooks/useReferenceLibrary";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, ExternalLink } from "lucide-react";
import { getContentTypeLabel } from "@/types/contentTypes";

interface ReferenceCardProps {
  reference: ReferenceItem;
  onEdit: (reference: ReferenceItem) => void;
  onDelete: (id: string) => void;
  onView: (reference: ReferenceItem) => void;
}

export function ReferenceCard({ reference, onEdit, onDelete, onView }: ReferenceCardProps) {
  return (
    <Card className="bg-card/50 border-border/50 hover:border-border transition-all h-[220px] flex flex-col group cursor-pointer" onClick={() => onView(reference)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-2 flex-1">{reference.title}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
            {getContentTypeLabel(reference.reference_type)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 py-0">
        <p className="text-xs text-muted-foreground line-clamp-4">
          {reference.content}
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
      <CardFooter className="flex justify-end gap-1 pt-3 pb-3 border-t mt-auto">
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
    </Card>
  );
}
