import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface TranscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcription: string;
  fileName?: string;
}

function TranscriptionModalComponent({
  open,
  onOpenChange,
  transcription,
  fileName,
}: TranscriptionModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = transcription.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Transcrição {fileName && `- ${fileName}`}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-2">
          {wordCount} palavras • {transcription.length} caracteres
        </div>
        <ScrollArea className="h-[400px] rounded-md border p-4">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {transcription}
          </p>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export const TranscriptionModal = memo(TranscriptionModalComponent);
