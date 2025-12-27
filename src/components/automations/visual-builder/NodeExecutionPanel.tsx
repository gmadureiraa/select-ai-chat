import { useState } from "react";
import { Play, AlertCircle, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FieldItem {
  key: string;
  type: "string" | "number" | "object" | "array";
  value?: string;
  children?: FieldItem[];
}

interface NodeExecutionPanelProps {
  nodeId: string;
  nodeLabel: string;
  inputData?: any;
  outputData?: any;
  isExecuting?: boolean;
  error?: string;
  onExecute?: () => void;
  onSetMockData?: () => void;
  previousNodeLabel?: string;
}

const FieldTree = ({ fields, level = 0 }: { fields: FieldItem[]; level?: number }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={cn("space-y-1", level > 0 && "ml-4 border-l border-border pl-2")}>
      {fields.map((field) => {
        const hasChildren = field.children && field.children.length > 0;
        const isExpanded = expanded[field.key];

        return (
          <div key={field.key}>
            <div
              className={cn(
                "flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm",
                hasChildren && "cursor-pointer"
              )}
              onClick={() => hasChildren && toggleExpand(field.key)}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )
              ) : (
                <div className="w-3" />
              )}
              
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-1.5 py-0 h-5 font-mono",
                  field.type === "string" && "border-green-500/50 text-green-600",
                  field.type === "number" && "border-blue-500/50 text-blue-600",
                  field.type === "object" && "border-orange-500/50 text-orange-600",
                  field.type === "array" && "border-purple-500/50 text-purple-600"
                )}
              >
                {field.type === "string" ? "T" : 
                 field.type === "number" ? "#" : 
                 field.type === "object" ? "{}" : "[]"}
              </Badge>
              
              <span className="font-medium text-foreground">{field.key}</span>
              
              {field.value !== undefined && !hasChildren && (
                <span className="text-muted-foreground truncate max-w-[200px]">
                  {field.value}
                </span>
              )}
            </div>
            
            {hasChildren && isExpanded && (
              <FieldTree fields={field.children!} level={level + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const parseDataToFields = (data: any, prefix = ""): FieldItem[] => {
  if (!data || typeof data !== "object") return [];
  
  return Object.entries(data).map(([key, value]): FieldItem => {
    if (Array.isArray(value)) {
      return {
        key,
        type: "array",
        children: value.map((item, idx) => ({
          key: `[${idx}]`,
          type: typeof item === "object" ? "object" : typeof item as any,
          value: typeof item !== "object" ? String(item) : undefined,
          children: typeof item === "object" ? parseDataToFields(item) : undefined,
        })),
      };
    }
    
    if (typeof value === "object" && value !== null) {
      return {
        key,
        type: "object",
        children: parseDataToFields(value),
      };
    }
    
    return {
      key,
      type: typeof value === "number" ? "number" : "string",
      value: String(value),
    };
  });
};

export const NodeExecutionPanel = ({
  nodeId,
  nodeLabel,
  inputData,
  outputData,
  isExecuting,
  error,
  onExecute,
  onSetMockData,
  previousNodeLabel,
}: NodeExecutionPanelProps) => {
  const inputFields = inputData ? parseDataToFields(inputData) : [];
  const outputFields = outputData ? parseDataToFields(outputData) : [];

  return (
    <div className="flex h-full bg-card">
      {/* INPUT Panel */}
      <div className="w-[280px] border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              INPUT
            </span>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-[10px] px-1.5 h-5">Schema</Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">Table</Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">JSON</Badge>
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-3">
          {previousNodeLabel ? (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 rounded hover:bg-muted/50">
                <ChevronDown className="h-3 w-3" />
                <span className="text-sm font-medium flex items-center gap-1">
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">→</Badge>
                  {previousNodeLabel}
                </span>
                <span className="text-xs text-primary ml-auto">+</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-xs text-muted-foreground p-2 mb-2">
                  The fields below come from the last successful execution.{" "}
                  <button className="text-primary hover:underline">Execute node</button> to refresh.
                </p>
                {inputFields.length > 0 ? (
                  <FieldTree fields={inputFields} />
                ) : (
                  <p className="text-xs text-muted-foreground p-2">No input data available</p>
                )}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <p className="text-xs text-muted-foreground p-2">
              No previous node connected
            </p>
          )}
          
          <Collapsible className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 rounded hover:bg-muted/50">
              <ChevronRight className="h-3 w-3" />
              <span className="text-sm font-medium">Variables and context</span>
            </CollapsibleTrigger>
          </Collapsible>
        </ScrollArea>
      </div>

      {/* Center - Node Config would go here */}
      
      {/* OUTPUT Panel */}
      <div className="w-[280px] border-l border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            OUTPUT
          </span>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-[10px] px-1.5 h-5">Schema</Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">Table</Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">JSON</Badge>
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-3">
          {error ? (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium text-sm">Error</span>
              </div>
              <p className="text-xs text-destructive/80">{error}</p>
            </div>
          ) : outputFields.length > 0 ? (
            <FieldTree fields={outputFields} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-sm text-muted-foreground mb-2">
                Execute this node to view data
              </p>
              <button 
                className="text-sm text-primary hover:underline"
                onClick={onSetMockData}
              >
                or set mock data
              </button>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
