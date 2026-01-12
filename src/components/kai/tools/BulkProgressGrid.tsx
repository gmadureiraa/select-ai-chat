import { useState, useEffect } from "react";
import { Check, Loader2, Clock, AlertCircle, Search, PenTool, Edit3, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BulkContentItem } from "@/hooks/useBulkContentCreator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface BulkProgressGridProps {
  items: BulkContentItem[];
  isGenerating: boolean;
}

// Agent phases for the multi-agent pipeline
const AGENT_PHASES = [
  { id: 'research', label: 'Pesquisando', icon: Search, color: 'text-blue-500' },
  { id: 'writing', label: 'Escrevendo', icon: PenTool, color: 'text-purple-500' },
  { id: 'editing', label: 'Editando', icon: Edit3, color: 'text-orange-500' },
  { id: 'reviewing', label: 'Revisando', icon: CheckCircle, color: 'text-emerald-500' },
];

export function BulkProgressGrid({ items, isGenerating }: BulkProgressGridProps) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const generatingCount = items.filter(i => i.status === 'generating').length;
  const progress = items.length > 0 ? ((doneCount + errorCount) / items.length) * 100 : 0;

  // Simulate agent phase progression during generation
  useEffect(() => {
    if (!isGenerating || generatingCount === 0) {
      setCurrentPhase(0);
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentPhase(prev => (prev + 1) % AGENT_PHASES.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isGenerating, generatingCount]);

  // Track elapsed time
  useEffect(() => {
    if (!isGenerating) {
      setElapsedTime(0);
      return;
    }
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isGenerating]);

  if (items.length === 0) return null;

  // Estimate remaining time based on progress
  const estimatedTotal = items.length * 15; // ~15 seconds per item
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsedTime);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const CurrentAgentIcon = AGENT_PHASES[currentPhase].icon;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Agent indicator - shows which agent is working */}
        {isGenerating && generatingCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className={cn("p-2 rounded-full bg-background animate-pulse", AGENT_PHASES[currentPhase].color)}>
              <CurrentAgentIcon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{AGENT_PHASES[currentPhase].label}...</span>
                <span className="text-xs text-muted-foreground">
                  ~{formatTime(estimatedRemaining)} restantes
                </span>
              </div>
              {/* Agent phase indicators */}
              <div className="flex gap-1 mt-2">
                {AGENT_PHASES.map((phase, idx) => (
                  <div
                    key={phase.id}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      idx < currentPhase ? "bg-emerald-500" :
                      idx === currentPhase ? "bg-primary animate-pulse" : 
                      "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isGenerating ? "Gerando conteúdos..." : "Concluído"}
            </span>
            <div className="flex items-center gap-3">
              {isGenerating && (
                <span className="text-xs text-muted-foreground">
                  {formatTime(elapsedTime)} decorridos
                </span>
              )}
              <span className="font-medium">{doneCount + errorCount}/{items.length}</span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Mini status grid with tooltips */}
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-default",
                    item.status === 'done' && "bg-emerald-500/20 text-emerald-600",
                    item.status === 'generating' && "bg-primary/20 text-primary animate-pulse",
                    item.status === 'pending' && "bg-muted text-muted-foreground",
                    item.status === 'error' && "bg-destructive/20 text-destructive"
                  )}
                >
                  {item.status === 'done' && <Check className="h-4 w-4" />}
                  {item.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {item.status === 'pending' && <Clock className="h-3 w-3" />}
                  {item.status === 'error' && <AlertCircle className="h-4 w-4" />}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{item.format.replace(/_/g, ' ')} #{item.index + 1}</p>
                <p className="text-muted-foreground capitalize">{
                  item.status === 'done' ? 'Concluído' :
                  item.status === 'generating' ? 'Gerando...' :
                  item.status === 'pending' ? 'Aguardando' : 'Erro'
                }</p>
                {item.status === 'done' && item.content && (
                  <p className="mt-1 max-w-48 truncate text-muted-foreground">
                    {item.content.substring(0, 60)}...
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
