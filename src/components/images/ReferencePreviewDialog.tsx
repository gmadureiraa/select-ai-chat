import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReferencePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  description: string;
}

export const ReferencePreviewDialog = ({
  open,
  onOpenChange,
  imageUrl,
  description,
}: ReferencePreviewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{description}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <img
            src={imageUrl}
            alt={description}
            className="w-full rounded-lg"
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
