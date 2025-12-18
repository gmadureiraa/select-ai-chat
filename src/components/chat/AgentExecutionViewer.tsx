import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronRight,
  Database,
  FileText,
  Image,
  BarChart3,
  BookOpen,
  Check,
  Loader2,
  Clock,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataSource {
  type: string;
  name: string;
  count?: number;
  items?: string[];
}

interface ExecutionStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  dataSources?: DataSource[];
  output?: string;
  durationMs?: number;
}

interface AgentExecutionViewerProps {
  steps: ExecutionStep[];
  isExpanded?: boolean;
  onToggle?: () => void;
  showDataSources?: boolean;
}

const DATA_SOURCE_ICONS: Record<string, typeof Database> = {
  identity_guide: FileText,
  content_library: BookOpen,
  reference_library: BookOpen,
  visual_references: Image,
  brand_assets: Image,
  platform_metrics: BarChart3,
  instagram_posts: Image,
  youtube_videos: BarChart3,
  global_knowledge: Database,
  copywriting_guide: FileText,
};

export function AgentExecutionViewer({ 
  steps, 
  isExpanded = false,
  onToggle,
  showDataSources = true
}: AgentExecutionViewerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: ExecutionStep["status"]) => {
    switch (status) {
      case "completed":
        return <Check className="h-3.5 w-3.5 text-green-500" />;
      case "running":
        return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
      case "error":
        return <span className="h-3.5 w-3.5 rounded-full bg-destructive" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ExecutionStep["status"]) => {
    switch (status) {
      case "completed":
        return "border-green-500/30 bg-green-500/5";
      case "running":
        return "border-primary/30 bg-primary/5";
      case "error":
        return "border-destructive/30 bg-destructive/5";
      default:
        return "border-border/50 bg-muted/20";
    }
  };

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Caminho de Execução</span>
          <Badge variant="outline" className="text-[10px]">
            {steps.filter(s => s.status === "completed").length}/{steps.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-border/50 p-3 space-y-2">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    getStatusColor(step.status)
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(step.status)}
                      <span className="text-sm font-medium">{step.name}</span>
                      {step.durationMs && (
                        <span className="text-[10px] text-muted-foreground">
                          {step.durationMs > 1000 
                            ? `${(step.durationMs / 1000).toFixed(1)}s`
                            : `${step.durationMs}ms`
                          }
                        </span>
                      )}
                    </div>
                    {(step.dataSources?.length || step.output) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleStep(step.id)}
                      >
                        {expandedSteps.has(step.id) ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  <AnimatePresence>
                    {expandedSteps.has(step.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 space-y-2"
                      >
                        {showDataSources && step.dataSources && step.dataSources.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              Fontes Consultadas
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {step.dataSources.map((ds, i) => {
                                const Icon = DATA_SOURCE_ICONS[ds.type] || Database;
                                return (
                                  <Badge 
                                    key={i}
                                    variant="outline" 
                                    className="text-[10px] gap-1 bg-background/50"
                                  >
                                    <Icon className="h-2.5 w-2.5" />
                                    {ds.name}
                                    {ds.count !== undefined && (
                                      <span className="text-muted-foreground">
                                        ({ds.count})
                                      </span>
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {step.output && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              Output
                            </span>
                            <ScrollArea className="max-h-32 rounded border border-border/30 bg-muted/30 p-2">
                              <pre className="text-xs whitespace-pre-wrap font-sans">
                                {step.output.length > 500 
                                  ? step.output.substring(0, 500) + "..."
                                  : step.output
                                }
                              </pre>
                            </ScrollArea>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
