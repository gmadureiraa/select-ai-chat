import { memo, useState, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2, FileJson, FileText, ScanText, Maximize2, Loader2, ArrowRight, X } from "lucide-react";
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
  const [showActionsPanel, setShowActionsPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleAnalyzeJson = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateData(id, { isProcessing: true, processingType: "json" });
    try {
      await onAnalyzeJson(id, data.imageUrl);
    } finally {
      onUpdateData(id, { isProcessing: false, processingType: null });
    }
  }, [id, data.imageUrl, onAnalyzeJson, onUpdateData]);

  const handleGenerateDescription = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateData(id, { isProcessing: true, processingType: "description" });
    try {
      await onGenerateDescription(id, data.imageUrl);
    } finally {
      onUpdateData(id, { isProcessing: false, processingType: null });
    }
  }, [id, data.imageUrl, onGenerateDescription, onUpdateData]);

  const handleExtractOcr = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateData(id, { isProcessing: true, processingType: "ocr" });
    try {
      await onExtractOcr(id, data.imageUrl);
    } finally {
      onUpdateData(id, { isProcessing: false, processingType: null });
    }
  }, [id, data.imageUrl, onExtractOcr, onUpdateData]);

  const handleConvertToAttachment = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onConvertToAttachment(id, data.imageUrl);
  }, [id, data.imageUrl, onConvertToAttachment]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.isProcessing) {
      setShowActionsPanel(prev => !prev);
    }
  }, [data.isProcessing]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  }, [id, onDelete]);

  const handlePreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(true);
    setShowActionsPanel(false);
  }, []);

  const handleShowAnalysis = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAnalysis(true);
    setShowActionsPanel(false);
  }, []);

  const hasAnalysis = data.analysis?.description || data.analysis?.jsonAnalysis || data.analysis?.ocrText;

  return (
    <>
      <div
        className={cn(
          "group relative rounded-lg overflow-visible bg-background border shadow-md",
          selected && "ring-2 ring-primary ring-offset-2",
          data.isProcessing && "opacity-75"
        )}
        style={{ 
          maxWidth: 400, 
          minWidth: 150,
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-primary" />
        <Handle type="source" position={Position.Right} className="!bg-primary" />

        {/* Delete button - always visible */}
        <Button
          variant="secondary"
          size="icon"
          className="nodrag absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground z-10"
          onClick={handleDelete}
        >
          <X size={12} />
        </Button>

        {/* Image - Full size, clickable */}
        <div 
          className="cursor-pointer"
          onClick={handleImageClick}
        >
          <img
            src={data.imageUrl}
            alt={data.caption || "Imagem"}
            className="w-full h-auto object-contain rounded-lg max-h-[400px]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
            draggable={false}
          />
        </div>

        {/* Processing overlay */}
        {data.isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
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

        {/* Analysis indicator badge */}
        {hasAnalysis && !data.isProcessing && (
          <div
            className="nodrag absolute bottom-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:bg-primary/90 transition-colors shadow-md"
            onClick={handleShowAnalysis}
          >
            <FileJson size={14} />
          </div>
        )}

        {/* Actions Panel - appears on click */}
        {showActionsPanel && !data.isProcessing && (
          <div className="nodrag absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg p-3 z-20">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Ações de IA</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleAnalyzeJson}
                >
                  <FileJson size={14} className="mr-1" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleGenerateDescription}
                >
                  <FileText size={14} className="mr-1" />
                  Descrição
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleExtractOcr}
                >
                  <ScanText size={14} className="mr-1" />
                  OCR
                </Button>
              </div>
              
              <div className="h-px bg-border my-1" />
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handlePreview}
                >
                  <Maximize2 size={14} className="mr-1" />
                  Expandir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs text-primary hover:text-primary"
                  onClick={handleConvertToAttachment}
                >
                  <ArrowRight size={14} className="mr-1" />
                  Usar como Anexo
                </Button>
              </div>

              {hasAnalysis && (
                <>
                  <div className="h-px bg-border my-1" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleShowAnalysis}
                  >
                    <FileJson size={14} className="mr-1" />
                    Ver Análises
                  </Button>
                </>
              )}
            </div>
          </div>
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
