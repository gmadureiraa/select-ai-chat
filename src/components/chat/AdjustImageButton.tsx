import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface AdjustImageButtonProps {
  imageUrl: string;
  onAdjust: (prompt: string) => void;
  isLoading?: boolean;
}

export const AdjustImageButton = ({
  imageUrl,
  onAdjust,
  isLoading = false,
}: AdjustImageButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [adjustments, setAdjustments] = useState("");

  const handleSubmit = () => {
    if (!adjustments.trim()) return;
    
    // Build a prompt that references the previous image and requests changes
    const prompt = `Ajuste a imagem anterior com as seguintes alterações: ${adjustments}`;
    onAdjust(prompt);
    setShowDialog(false);
    setAdjustments("");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={isLoading}
        className={cn(
          "h-7 text-xs gap-1.5 bg-gradient-to-r from-violet-500/5 to-violet-500/10 border-violet-500/20",
          "hover:from-violet-500/10 hover:to-violet-500/20 hover:border-violet-500/40"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Wand2 className="h-3 w-3" />
        )}
        Ajustar imagem
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar imagem</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Preview of current image */}
            <div className="rounded-lg overflow-hidden border border-border">
              <img 
                src={imageUrl} 
                alt="Imagem atual" 
                className="w-full h-32 object-cover"
              />
            </div>

            {/* Adjustment input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Descreva as alterações
              </label>
              <Textarea
                value={adjustments}
                onChange={(e) => setAdjustments(e.target.value)}
                placeholder="Ex: Mude as cores para tons de azul, adicione mais contraste, remova o texto..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!adjustments.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Gerar nova imagem
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
