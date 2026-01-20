import { memo, useState, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2, FileJson, FileText, ScanText, Maximize2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface QuickImageNodeData {
  type: "quick-image";
  imageUrl: string;
  caption?: string;
  analysis?: {
    description?: string;
    jsonAnalysis?: Record<string, unknown>;
    ocrText?: string;
  };
  isProcessing?: boolean;
  processingType?: "json" | "description" | "ocr" | null;
}

interface QuickImageNodeProps extends NodeProps<QuickImageNodeData> {
  onUpdateData: (id: string, data: Partial<QuickImageNodeData>) => void;
  onDelete: (id: string) => void;
  onAnalyzeJson: (id: string, imageUrl: string) => Promise<void>;
  onGenerateDescription: (id: string, imageUrl: string) => Promise<void>;
  onExtractOcr: (id: string, imageUrl: string) => Promise<void>;
  onConvertToAttachment: (id: string, imageUrl: string) => void;
}

function QuickImageNodeComponent({
  id,
  data,
  selected,
  onUpdateData,
  onDelete,
  onAnalyzeJson,
  onGenerateDescription,
  onExtractOcr,
  onConvertToAttachment,
}: QuickImageNodeProps) {
  const [showControls, setShowControls] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleAnalyzeJson = useCallback(async () => {
    onUpdateData(id, { isProcessing: true, processingType: "json" });
    try {
      await onAnalyzeJson(id, data.imageUrl);
    } finally {
      onUpdateData(id, { isProcessing: false, processingType: null });
    }
  }, [id, data.imageUrl, onAnalyzeJson, onUpdateData]);

  const handleGenerateDescription = useCallback(async () => {
    onUpdateData(id, { isProcessing: true, processingType: "description" });
    try {
      await onGenerateDescription(id, data.imageUrl);
    } finally {
      onUpdateData(id, { isProcessing: false, processingType: null });
    }
  }, [id, data.imageUrl, onGenerateDescription, onUpdateData]);

  const handleExtractOcr = useCallback(async () => {
    onUpdateData(id, { isProcessing: true, processingType: "ocr" });
    try {
      await onExtractOcr(id, data.imageUrl);
    } finally {
      onUpdateData(id, { isProcessing: false, processingType: null });
    }
  }, [id, data.imageUrl, onExtractOcr, onUpdateData]);

  const hasAnalysis = data.analysis?.description || data.analysis?.jsonAnalysis || data.analysis?.ocrText;

  return (
    <>
      <div
        className={cn(
          "group relative rounded-lg overflow-hidden bg-background border shadow-md",
          selected && "ring-2 ring-primary ring-offset-2",
          data.isProcessing && "opacity-75"
        )}
        style={{ width: 200, height: 200 }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <Handle type="target" position={Position.Left} className="!bg-primary" />
        <Handle type="source" position={Position.Right} className="!bg-primary" />

        {/* Image */}
        <img
          src={data.imageUrl}
          alt={data.caption || "Imagem"}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />

        {/* Processing overlay */}
        {data.isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                {data.processingType === "json" && "Analisando..."}
                {data.processingType === "description" && "Descrevendo..."}
                {data.processingType === "ocr" && "Extraindo texto..."}
              </span>
            </div>
          </div>
        )}

        {/* Analysis indicator */}
        {hasAnalysis && !data.isProcessing && (
          <div
            className="absolute bottom-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={() => setShowAnalysis(true)}
          >
            <FileJson size={14} />
          </div>
        )}

        {/* Hover controls */}
        {(showControls || selected) && !data.isProcessing && (
          <>
            {/* Top toolbar */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between nodrag">
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 bg-background/90 hover:bg-background"
                onClick={() => setShowPreview(true)}
              >
                <Maximize2 size={14} />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 bg-background/90 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onDelete(id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>

            {/* Bottom action bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 nodrag">
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs bg-background/90 hover:bg-background"
                  onClick={handleAnalyzeJson}
                >
                  <FileJson size={12} className="mr-1" />
                  JSON
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs bg-background/90 hover:bg-background"
                  onClick={handleGenerateDescription}
                >
                  <FileText size={12} className="mr-1" />
                  Desc
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs bg-background/90 hover:bg-background"
                  onClick={handleExtractOcr}
                >
                  <ScanText size={12} className="mr-1" />
                  OCR
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1 h-6 text-xs text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => onConvertToAttachment(id, data.imageUrl)}
              >
                <ArrowRight size={12} className="mr-1" />
                Usar como Anexo
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Full preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Visualizar Imagem</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <img
              src={data.imageUrl}
              alt={data.caption || "Imagem"}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Analysis dialog */}
      <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Análise da Imagem</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {data.analysis?.description && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Descrição</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {data.analysis.description}
                  </p>
                </div>
              )}
              {data.analysis?.ocrText && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Texto Extraído (OCR)</h4>
                  <pre className="text-sm text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap font-mono">
                    {data.analysis.ocrText}
                  </pre>
                </div>
              )}
              {data.analysis?.jsonAnalysis && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Análise JSON</h4>
                  <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-lg overflow-auto font-mono">
                    {JSON.stringify(data.analysis.jsonAnalysis, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const QuickImageNode = memo(QuickImageNodeComponent);
