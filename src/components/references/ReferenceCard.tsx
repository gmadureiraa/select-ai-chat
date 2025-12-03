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
    <Card className="bg-card/50 border-border/50 hover:border-border transition-all">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2">{reference.title}</CardTitle>
          <Badge variant="outline" className="shrink-0">
            {getContentTypeLabel(reference.reference_type)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {reference.content}
        </p>
        {reference.source_url && (
          <div className="mt-3">
            <a
              href={reference.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Ver fonte original
            </a>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(reference)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(reference)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(reference.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
