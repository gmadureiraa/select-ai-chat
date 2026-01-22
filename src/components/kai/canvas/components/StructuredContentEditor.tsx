import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentFormat, Platform } from "../hooks/useCanvasState";
import { parseStructuredContent, serializeStructuredContent } from "../lib/structuredContent";
import { Plus, Trash2 } from "lucide-react";

export function StructuredContentEditor(props: {
  value: string;
  format: ContentFormat;
  platform: Platform;
  onChange: (next: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const { value, format, platform, onChange, className, compact } = props;

  const structured = useMemo(
    () => parseStructuredContent({ format, platform, text: value }),
    [format, platform, value]
  );

  const blocks = structured.blocks.length ? structured.blocks : [""];

  const updateBlock = (idx: number, next: string) => {
    const nextBlocks = [...blocks];
    nextBlocks[idx] = next;
    onChange(serializeStructuredContent({ ...structured, blocks: nextBlocks }));
  };

  const addBlock = () => {
    onChange(serializeStructuredContent({ ...structured, blocks: [...blocks, ""] }));
  };

  const removeBlock = (idx: number) => {
    const nextBlocks = blocks.filter((_, i) => i !== idx);
    onChange(serializeStructuredContent({ ...structured, blocks: nextBlocks.length ? nextBlocks : [""] }));
  };

  const perBlockLimit = platform === "twitter" ? 280 : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] h-5">
            Editor por blocos
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5">
            {structured.kind}
          </Badge>
        </div>
        {(structured.kind === "carousel" ||
          structured.kind === "thread" ||
          structured.kind === "newsletter" ||
          structured.kind === "linkedin_article") && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addBlock}>
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {blocks.map((b, idx) => {
          const label =
            structured.kind === "carousel"
              ? `Slide ${idx + 1}`
              : structured.kind === "thread"
                ? `Tweet ${idx + 1}`
                : structured.kind === "newsletter"
                  ? `Seção ${idx + 1}`
                  : structured.kind === "linkedin_article"
                    ? `Seção ${idx + 1}`
                    : `Bloco ${idx + 1}`;

          const charCount = (b || "").length;
          const over = perBlockLimit ? charCount > perBlockLimit : false;

          return (
            <div key={idx} className="rounded-md border bg-muted/20 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium">{label}</span>
                  <span className={cn("text-[10px] text-muted-foreground", over && "text-destructive font-medium")}>
                    {charCount}
                    {perBlockLimit ? `/${perBlockLimit}` : ""}
                  </span>
                </div>
                {(structured.kind === "carousel" ||
                  structured.kind === "thread" ||
                  structured.kind === "newsletter" ||
                  structured.kind === "linkedin_article") &&
                  blocks.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => removeBlock(idx)}
                      title="Remover bloco"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
              </div>
              <Textarea
                value={b}
                onChange={(e) => updateBlock(idx, e.target.value)}
                className={cn("text-xs resize-none", compact ? "min-h-[90px]" : "min-h-[120px]")}
                rows={compact ? 4 : 6}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

