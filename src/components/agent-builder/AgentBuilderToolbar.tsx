import { Bot, Zap, GitBranch, Wrench, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/types/agentBuilder";

interface AgentBuilderToolbarProps {
  onAddNode: (type: NodeType, config?: Record<string, any>) => void;
  activeTool: NodeType | null;
}

const tools = [
  { 
    id: "agent" as NodeType, 
    icon: Bot, 
    label: "Agent", 
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    iconBg: "bg-emerald-500"
  },
  { 
    id: "tool" as NodeType, 
    icon: Wrench, 
    label: "Tool", 
    color: "bg-emerald-500/5 text-emerald-600 border-emerald-200",
    iconBg: "bg-emerald-400"
  },
  { 
    id: "trigger" as NodeType, 
    icon: Zap, 
    label: "Trigger", 
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
    iconBg: "bg-amber-500"
  },
  { 
    id: "condition" as NodeType, 
    icon: GitBranch, 
    label: "Condition", 
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
    iconBg: "bg-purple-500"
  },
  { 
    id: "note" as NodeType, 
    icon: FileText, 
    label: "Note", 
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    iconBg: "bg-yellow-500"
  },
];

export const AgentBuilderToolbar = ({ onAddNode, activeTool }: AgentBuilderToolbarProps) => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-end gap-3 p-4 bg-muted/50 backdrop-blur-sm rounded-2xl">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onAddNode(tool.id)}
            className={cn(
              "group relative flex flex-col items-start transition-all duration-200",
              "hover:-translate-y-1"
            )}
          >
            {/* Tilted card with folded corner */}
            <div 
              className={cn(
                "relative w-[120px] h-[80px] rounded-xl border shadow-sm transition-all",
                "transform -rotate-2 hover:rotate-0 hover:shadow-md",
                tool.color,
                activeTool === tool.id && "ring-2 ring-primary"
              )}
            >
              {/* Folded corner */}
              <div className="absolute top-0 right-0 w-5 h-5 overflow-hidden rounded-tr-xl">
                <div className="absolute top-0 right-0 w-7 h-7 bg-white/40 transform rotate-45 translate-x-3 -translate-y-3 shadow-inner" />
              </div>
              
              {/* Badge with icon */}
              <div className="absolute top-3 left-3">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-xs font-medium shadow-sm",
                  tool.iconBg
                )}>
                  <tool.icon className="h-3 w-3" />
                  {tool.label}
                </div>
              </div>
              
              {/* Decorative lines */}
              <div className="absolute bottom-4 left-3 right-6 space-y-1.5">
                <div className="h-1 bg-current opacity-10 rounded-full w-3/4" />
                <div className="h-1 bg-current opacity-10 rounded-full w-1/2" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
