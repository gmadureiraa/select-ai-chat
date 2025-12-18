import { useState, useCallback, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntermediateOutput {
  stepId: string;
  agentType: string;
  agentName: string;
  output: string;
  durationMs?: number;
}

interface IntermediateOutputsViewerProps {
  outputs: IntermediateOutput[];
  isOpen: boolean;
  onClose: () => void;
  selectedStepId?: string;
}

export function IntermediateOutputsViewer({
  outputs,
  isOpen,
  onClose,
  selectedStepId
}: IntermediateOutputsViewerProps) {
  const [activeStep, setActiveStep] = useState(selectedStepId || outputs[0]?.stepId);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeOutput = outputs.find(o => o.stepId === activeStep);

  const copyToClipboard = useCallback(async (text: string, stepId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(stepId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Outputs Intermediários</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Steps sidebar */}
          <div className="w-48 flex-shrink-0 border-r border-border/50 pr-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Etapas</p>
            <div className="space-y-1">
              {outputs.map((output, index) => (
                <button
                  key={output.stepId}
                  onClick={() => setActiveStep(output.stepId)}
                  className={cn(
                    "w-full text-left p-2 rounded-lg transition-colors text-sm",
                    activeStep === output.stepId
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{output.agentName}</span>
                  </div>
                  {output.durationMs && (
                    <span className="text-[10px] text-muted-foreground/60 ml-5">
                      {output.durationMs > 1000 
                        ? `${(output.durationMs / 1000).toFixed(1)}s` 
                        : `${output.durationMs}ms`
                      }
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Output content */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeOutput && (
              <>
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{activeOutput.agentName}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {activeOutput.agentType}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => copyToClipboard(activeOutput.output, activeOutput.stepId)}
                  >
                    {copiedId === activeOutput.stepId ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                
                <ScrollArea className="flex-1 border rounded-lg bg-muted/30">
                  <div className="p-4">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {activeOutput.output}
                    </pre>
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export agent name mapping
export const AGENT_NAMES: Record<string, string> = {
  content_writer: "Escritor de Conteúdo",
  design_agent: "Designer Visual",
  metrics_analyst: "Analista de Métricas",
  email_developer: "Desenvolvedor de Email",
  researcher: "Pesquisador",
  strategist: "Estrategista"
};
