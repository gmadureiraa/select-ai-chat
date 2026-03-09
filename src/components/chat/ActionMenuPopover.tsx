import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface ActionMenuPopoverProps {
  onImageUpload: () => void;
  disabled?: boolean;
}

export const ActionMenuPopover = ({ onImageUpload, disabled }: ActionMenuPopoverProps) => {
  return (
    <Button
      onClick={onImageUpload}
      variant="ghost"
      size="icon"
      disabled={disabled}
      className="h-8 w-8 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-muted-foreground"
      title="Anexar arquivo"
    >
      <Paperclip className="h-3.5 w-3.5" />
    </Button>
  );
};
