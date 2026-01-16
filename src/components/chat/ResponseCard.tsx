import { CheckCircle2, Calendar, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SuccessCardPayload {
  type: "cards_created";
  message: string;
  clientName?: string;
  column?: string;
  format?: string;
  cards?: Array<{ id: string; title: string }>;
  totalCount: number;
}

export interface ResponseCardPayload {
  type: string;
  message?: string;
  clientName?: string;
  column?: string;
  format?: string;
  cards?: Array<{ id: string; title: string }>;
  totalCount?: number;
}

interface ResponseCardProps {
  payload: ResponseCardPayload;
  onViewPlanning?: () => void;
}

export function hasResponseCardPayload(message: { payload?: unknown }): boolean {
  if (!message.payload) return false;
  const p = message.payload as Record<string, unknown>;
  return p.type === "cards_created" && typeof p.totalCount === "number";
}

export function ResponseCard({ payload, onViewPlanning }: ResponseCardProps) {
  if (payload.type !== "cards_created") return null;

  return (
    <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{payload.message}</p>
          {payload.clientName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Cliente: {payload.clientName}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {payload.format && (
              <Badge variant="secondary" className="text-xs">
                {payload.format}
              </Badge>
            )}
            {payload.column && (
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {payload.column}
              </Badge>
            )}
            {payload.totalCount && (
              <span className="text-xs text-muted-foreground">
                {payload.totalCount} cards criados
              </span>
            )}
          </div>
          {onViewPlanning && (
            <Button
              variant="link"
              size="sm"
              className="h-6 px-0 mt-2 text-emerald-600 hover:text-emerald-700"
              onClick={onViewPlanning}
            >
              Ver no Planejamento
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
