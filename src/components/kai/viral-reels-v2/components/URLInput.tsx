/**
 * URLInput — campo dedicado pra colar link de Reel do Instagram, com botão
 * "Colar" que lê do clipboard e valida se é URL de Reel/IG.
 *
 * Usa Input + Button do shadcn pra ficar consistente com o KAI.
 */

import { Clipboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidInstagramUrl } from "../lib/utils";

interface Props {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function URLInput({ value, onChange, disabled }: Props) {
  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidInstagramUrl(text)) {
        onChange(text);
        toast.success("Link colado");
      } else {
        toast.error("Clipboard não tem URL de Reel válida");
      }
    } catch {
      toast.error("Não consegui ler o clipboard");
    }
  }

  return (
    <div>
      <Label className="text-xs">Link do Reel original (Instagram)</Label>
      <div className="mt-1 flex gap-2">
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
          spellCheck={false}
          disabled={disabled}
          className="font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePaste}
          disabled={disabled}
          className="shrink-0"
        >
          <Clipboard className="mr-1.5 h-3.5 w-3.5" /> Colar
        </Button>
      </div>
    </div>
  );
}
