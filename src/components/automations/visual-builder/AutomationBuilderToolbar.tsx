import { 
  Rss, 
  Webhook, 
  Clock, 
  Globe,
  Brain, 
  GitBranch, 
  Send, 
  Mail, 
  Workflow,
  FileText 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutomationNodeType } from "@/types/automationBuilder";

interface AutomationBuilderToolbarProps {
  onAddNode: (type: AutomationNodeType) => void;
}

const triggerTools = [
  { 
    id: "trigger_rss" as AutomationNodeType, 
    icon: Rss, 
    label: "RSS Feed", 
    color: "bg-orange-500/10 text-orange-600 border-orange-200",
    iconBg: "bg-orange-500"
  },
  { 
    id: "trigger_webhook" as AutomationNodeType, 
    icon: Webhook, 
    label: "Webhook", 
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
    iconBg: "bg-blue-500"
  },
  { 
    id: "trigger_schedule" as AutomationNodeType, 
    icon: Clock, 
    label: "Agendado", 
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
    iconBg: "bg-purple-500"
  },
  { 
    id: "trigger_api" as AutomationNodeType, 
    icon: Globe, 
    label: "API", 
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
    iconBg: "bg-cyan-500"
  },
];

const processTools = [
  { 
    id: "ai_process" as AutomationNodeType, 
    icon: Brain, 
    label: "IA", 
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    iconBg: "bg-emerald-500"
  },
  { 
    id: "condition" as AutomationNodeType, 
    icon: GitBranch, 
    label: "Condição", 
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
    iconBg: "bg-amber-500"
  },
];

const actionTools = [
  { 
    id: "action_publish" as AutomationNodeType, 
    icon: Send, 
    label: "Publicar", 
    color: "bg-pink-500/10 text-pink-600 border-pink-200",
    iconBg: "bg-pink-500"
  },
  { 
    id: "action_n8n" as AutomationNodeType, 
    icon: Workflow, 
    label: "n8n", 
    color: "bg-red-500/10 text-red-600 border-red-200",
    iconBg: "bg-red-500"
  },
  { 
    id: "action_webhook" as AutomationNodeType, 
    icon: Webhook, 
    label: "Webhook", 
    color: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
    iconBg: "bg-indigo-500"
  },
  { 
    id: "action_email" as AutomationNodeType, 
    icon: Mail, 
    label: "Email", 
    color: "bg-teal-500/10 text-teal-600 border-teal-200",
    iconBg: "bg-teal-500"
  },
];

const otherTools = [
  { 
    id: "note" as AutomationNodeType, 
    icon: FileText, 
    label: "Nota", 
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    iconBg: "bg-yellow-500"
  },
];

export const AutomationBuilderToolbar = ({ onAddNode }: AutomationBuilderToolbarProps) => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-6 p-4 bg-card/90 backdrop-blur-sm rounded-2xl border border-border shadow-lg">
        {/* Triggers */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Gatilhos</span>
          <div className="flex items-center gap-2">
            {triggerTools.map((tool) => (
              <ToolButton key={tool.id} tool={tool} onClick={() => onAddNode(tool.id)} />
            ))}
          </div>
        </div>

        <div className="h-12 w-px bg-border" />

        {/* Process */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Processamento</span>
          <div className="flex items-center gap-2">
            {processTools.map((tool) => (
              <ToolButton key={tool.id} tool={tool} onClick={() => onAddNode(tool.id)} />
            ))}
          </div>
        </div>

        <div className="h-12 w-px bg-border" />

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Ações</span>
          <div className="flex items-center gap-2">
            {actionTools.map((tool) => (
              <ToolButton key={tool.id} tool={tool} onClick={() => onAddNode(tool.id)} />
            ))}
          </div>
        </div>

        <div className="h-12 w-px bg-border" />

        {/* Other */}
        <div className="flex items-center gap-2">
          {otherTools.map((tool) => (
            <ToolButton key={tool.id} tool={tool} onClick={() => onAddNode(tool.id)} />
          ))}
        </div>
      </div>
    </div>
  );
};

interface ToolButtonProps {
  tool: {
    id: AutomationNodeType;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    iconBg: string;
  };
  onClick: () => void;
}

const ToolButton = ({ tool, onClick }: ToolButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all",
        "hover:scale-105 hover:shadow-md",
        tool.color
      )}
    >
      <div className={cn("p-1 rounded-md", tool.iconBg)}>
        <tool.icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-xs font-medium">{tool.label}</span>
    </button>
  );
};
