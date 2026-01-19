import { Check, X, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ApprovalStatusType = "draft" | "pending" | "approved" | "rejected";

interface ApprovalStatusProps {
  status: ApprovalStatusType;
  onStatusChange: (status: ApprovalStatusType) => void;
  compact?: boolean;
}

const STATUS_CONFIG: Record<ApprovalStatusType, {
  label: string;
  icon: typeof Check;
  color: string;
  bgColor: string;
}> = {
  draft: {
    label: "Rascunho",
    icon: Clock,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  pending: {
    label: "Aguardando",
    icon: AlertCircle,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
  },
  approved: {
    label: "Aprovado",
    icon: Check,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
  },
  rejected: {
    label: "Rejeitado",
    icon: X,
    color: "text-red-600",
    bgColor: "bg-red-500/10",
  },
};

export function ApprovalStatus({ 
  status, 
  onStatusChange,
  compact = false 
}: ApprovalStatusProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6",
                  status === "approved" && "bg-green-500/20 text-green-600"
                )}
                onClick={() => onStatusChange(status === "approved" ? "draft" : "approved")}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {status === "approved" ? "Remover aprovação" : "Aprovar"}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6",
                  status === "rejected" && "bg-red-500/20 text-red-600"
                )}
                onClick={() => onStatusChange(status === "rejected" ? "draft" : "rejected")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {status === "rejected" ? "Remover rejeição" : "Rejeitar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="secondary" 
        className={cn("text-[10px] h-5 gap-1", config.bgColor, config.color)}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      
      <div className="flex items-center gap-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-green-500/10 hover:text-green-600",
                  status === "approved" && "bg-green-500/20 text-green-600"
                )}
                onClick={() => onStatusChange(status === "approved" ? "draft" : "approved")}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aprovar</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 hover:bg-red-500/10 hover:text-red-600",
                  status === "rejected" && "bg-red-500/20 text-red-600"
                )}
                onClick={() => onStatusChange(status === "rejected" ? "draft" : "rejected")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rejeitar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
